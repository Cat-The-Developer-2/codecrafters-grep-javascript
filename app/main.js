const fs = require("fs");
const path = require("path");

// ------------------------ MATCHER ------------------------

/**
 * Matches a single, non-quantified AST node against the input at a given position.
 * @param {object} node - The AST node to match.
 * @param {string} input - The input string.
 * @param {number} pos - The current position in the input string.
 * @returns {[boolean, number]} A tuple containing a boolean indicating if the match was successful
 * and a number indicating how many characters were consumed.
 */
function matchAtom(node, input, pos) {
  // For a group, try each alternative option. An option is a sequence.
  if (node.type === "group") {
    for (const option of node.options) {
      const [optionMatched, newPos] = matchSequence(option, input, pos);
      if (optionMatched) {
        return [true, newPos - pos]; // First successful option wins.
      }
    }
    return [false, 0]; // No option matched.
  }

  // For non-group nodes, we can't match past the end of the input.
  const char = input[pos];
  if (char === undefined) return [false, 0];

  if (node.type === "char") {
    if (node.char === ".") return [true, 1]; // Wildcard
    return char === node.char ? [true, 1] : [false, 0];
  }

  if (node.type === "escape") {
    if (node.code === "d") return /\d/.test(char) ? [true, 1] : [false, 0];
    if (node.code === "w") return /\w/.test(char) ? [true, 1] : [false, 0];
    return [false, 0];
  }

  if (node.type === "class") {
    const match = node.chars.includes(char);
    return node.negated
      ? !match
        ? [true, 1]
        : [false, 0]
      : match
      ? [true, 1]
      : [false, 0];
  }

  return [false, 0];
}

/**
 * Matches a sequence of AST nodes against the input string using a recursive backtracking algorithm.
 * @param {object[]} ast - The sequence of AST nodes to match.
 * @param {string} input - The input string.
 * @param {number} pos - The starting position for the match.
 * @returns {[boolean, number]} A tuple containing a boolean indicating success and the final position after matching.
 */
function matchSequence(ast, input, pos) {
  // Base case: If the pattern sequence is empty, we have a successful match.
  if (ast.length === 0) {
    return [true, pos];
  }

  const node = ast[0];
  const restOfAST = ast.slice(1);

  // Handle the '?' quantifier (zero or one)
  if (node.quant === "?") {
    // Greedily try to match the atom first.
    const [atomMatched, atomConsumed] = matchAtom(node, input, pos);
    if (atomMatched) {
      // If the atom matched, try matching the rest of the sequence from the new position.
      const [restMatched, finalPos] = matchSequence(
        restOfAST,
        input,
        pos + atomConsumed
      );
      if (restMatched) {
        return [true, finalPos];
      }
    }
    // If the greedy match didn't work, backtrack and try skipping the optional atom.
    return matchSequence(restOfAST, input, pos);
  }

  // Handle the '+' quantifier (one or more)
  if (node.quant === "+") {
    const consumptionPoints = [];
    let currentPos = pos;

    // First, we must match at least once.
    const [firstMatch, firstConsumed] = matchAtom(node, input, currentPos);
    if (!firstMatch || firstConsumed === 0) {
      return [false, pos]; // Failed to match even once.
    }
    currentPos += firstConsumed;
    consumptionPoints.push(currentPos);

    // Greedily match subsequent occurrences.
    while (true) {
      const [atomMatched, atomConsumed] = matchAtom(node, input, currentPos);
      if (!atomMatched || atomConsumed === 0) {
        break; // Stop if no match or no progress to prevent infinite loops.
      }
      currentPos += atomConsumed;
      consumptionPoints.push(currentPos);
    }

    // Backtrack: Try to match the rest of the sequence from each consumption point, from most to least greedy.
    for (let i = consumptionPoints.length - 1; i >= 0; i--) {
      const startForRest = consumptionPoints[i];
      const [restMatched, finalPos] = matchSequence(
        restOfAST,
        input,
        startForRest
      );
      if (restMatched) {
        return [true, finalPos]; // Found a working match.
      }
    }
    return [false, pos]; // All backtracking attempts failed.
  }

  // No quantifier: match a single atom.
  const [atomMatched, atomConsumed] = matchAtom(node, input, pos);
  if (atomMatched) {
    // If it matched, continue with the rest of the sequence.
    return matchSequence(restOfAST, input, pos + atomConsumed);
  }

  return [false, pos];
}

/**
 * Checks if a line matches the given pattern AST.
 * @param {string} line - The line of text to check.
 * @param {object[]} ast - The parsed pattern (Abstract Syntax Tree).
 * @param {boolean} anchoredStart - Whether the pattern is anchored to the start of the line (^).
 * @param {boolean} anchoredEnd - Whether the pattern is anchored to the end of the line ($).
 * @returns {boolean} - True if the line matches, false otherwise.
 */
function isMatch(line, ast, anchoredStart, anchoredEnd) {
  // If anchored to the start, attempt a match only from position 0.
  if (anchoredStart) {
    const [ok, consumed] = matchSequence(ast, line, 0);
    return ok && (!anchoredEnd || consumed === line.length);
  }

  // If not anchored, slide along the string and try to match from each position.
  for (let i = 0; i <= line.length; i++) {
    const [ok, consumed] = matchSequence(ast, line.slice(i), 0);
    // If a match is found, check the end anchor condition.
    if (ok && (!anchoredEnd || consumed === line.slice(i).length)) {
      return true;
    }
  }
  return false;
}

// ------------------------ PARSER ------------------------

/**
 * Parses a regular expression pattern into an Abstract Syntax Tree (AST).
 * @param {string} pattern - The regular expression pattern string.
 * @returns {object[]} - An array of AST nodes representing the parsed pattern.
 */
function parse(pattern) {
  let i = 0;

  function parseQuantifier() {
    if (pattern[i] === "+") return i++, "+";
    if (pattern[i] === "?") return i++, "?";
    return null;
  }

  function parseCharClass() {
    const end = pattern.indexOf("]", i);
    if (end === -1) throw new Error("Unclosed character class '['");
    const content = pattern.slice(i + 1, end);
    const isNegated = content.startsWith("^");
    const chars = isNegated ? content.slice(1) : content;
    i = end + 1;
    const quant = parseQuantifier();
    return { type: "class", chars, negated: isNegated, quant };
  }

  function parseGroup() {
    i++; // Skip '('
    const options = [];
    let branch = [];
    while (i < pattern.length && pattern[i] !== ")") {
      if (pattern[i] === "|") {
        options.push(branch);
        branch = [];
        i++;
      } else {
        branch.push(...parseSequence());
      }
    }
    if (pattern[i] !== ")") throw new Error("Unclosed group ')'");
    i++; // Skip ')'
    options.push(branch);
    const quant = parseQuantifier();
    return { type: "group", options, quant };
  }

  function parseSequence() {
    const nodes = [];
    while (i < pattern.length && pattern[i] !== ")" && pattern[i] !== "|") {
      const c = pattern[i];
      if (c === "(") {
        nodes.push(parseGroup());
      } else if (c === "[") {
        nodes.push(parseCharClass());
      } else if (c === "\\") {
        i++; // Skip '\'
        const esc = pattern[i++];
        const quant = parseQuantifier();
        nodes.push({ type: "escape", code: esc, quant });
      } else {
        const char = pattern[i++];
        const quant = parseQuantifier();
        nodes.push({ type: "char", char, quant });
      }
    }
    return nodes;
  }

  return parseSequence();
}

// ------------------------ MAIN ------------------------

/**
 * Main application entry point.
 */
function main() {
  const args = process.argv.slice(2);
  let recursive = false;
  let pattern;
  let filePaths;

  // Argument parsing
  if (args[0] === "-r" && args[1] === "-E") {
    recursive = true;
    pattern = args[2];
    filePaths = args.slice(3);
  } else if (args[0] === "-E") {
    pattern = args[1];
    filePaths = args.slice(2);
  } else {
    console.error(
      "Usage: node your_program.js [-r] -E <pattern> [files or dirs]"
    );
    process.exit(1);
  }

  if (!pattern) {
    console.error("Pattern must be provided.");
    process.exit(1);
  }

  const anchoredStart = pattern.startsWith("^");
  const anchoredEnd = pattern.endsWith("$");
  const cleanPattern = pattern.replace(/^\^/, "").replace(/\$$/, "");
  const ast = parse(cleanPattern);
  let matched = false;

  const filesToSearch = [];

  function collectFilesRecursively(p) {
    try {
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        const entries = fs.readdirSync(p);
        for (const entry of entries) {
          collectFilesRecursively(path.join(p, entry));
        }
      } else if (stat.isFile()) {
        filesToSearch.push(p);
      }
    } catch (err) {
      // Silently ignore errors like permission denied
    }
  }

  // Handle input from stdin if no files are provided
  if (filePaths.length === 0) {
    const data = fs.readFileSync(0, "utf-8"); // Read from stdin
    const lines = data.split("\n");
    for (const line of lines) {
      if (line && isMatch(line, ast, anchoredStart, anchoredEnd)) {
        console.log(line);
        matched = true;
      }
    }
  } else {
    // Collect all files to be searched
    for (const p of filePaths) {
      if (recursive) {
        collectFilesRecursively(p);
      } else {
        filesToSearch.push(p);
      }
    }

    // Process each file
    for (const file of filesToSearch) {
      const fileContent = fs.readFileSync(file, "utf-8");
      const lines = fileContent.split("\n");
      for (const line of lines) {
        if (line && isMatch(line, ast, anchoredStart, anchoredEnd)) {
          // In recursive or multi-file mode, always prefix with the filename
          if (recursive || filePaths.length > 1) {
            console.log(`${file}:${line}`);
          } else {
            console.log(line);
          }
          matched = true;
        }
      }
    }
  }

  process.exit(matched ? 0 : 1);
}

// Run the main function
main();
