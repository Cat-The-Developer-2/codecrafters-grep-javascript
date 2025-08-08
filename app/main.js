const fs = require("fs");
const path = require("path");

function main() {
  const args = process.argv.slice(2);
  const flag = process.argv[2];
  const pattern = process.argv[3];

  let data;

  if (args.length > 2) {
    data = fs.readFileSync(path.join(process.cwd(), args[2]), "utf-8");
  } else {
    data = fs.readFileSync(0, "utf-8");
  }

  const inputLine = data.trim().split("\n");

  if (flag !== "-E") {
    console.error("Expected first argument to be '-E'");
    process.exit(1);
  }

  const anchoredStart = pattern.startsWith("^");
  const anchoredEnd = pattern.endsWith("$");
  const cleanPattern = pattern.replace(/^\^/, "").replace(/\$$/, "");

  let matched = false;

  for (const line of inputLine) {
    if (anchoredStart) {
      if (matchPattern(cleanPattern, line, anchoredEnd)) {
        console.log(line); // Full input matches
        process.exit(0);
      }
    } else {
      for (let i = 0; i < line.length; i++) {
        const slice = line.slice(i);
        const ast = parse(cleanPattern);
        const [ok, consumed] = matchSequence(ast, slice, 0);
        if (ok && (!anchoredEnd || consumed === slice.length)) {
          console.log(line);
          process.exit(0);
        }
      }

      if (matched) process.exit(0);
    }
  }

  process.exit(1);
}

function matchPattern(pattern, input, mustConsumeAll) {
  const ast = parse(pattern);
  const [matched, posAfterMatch] = matchSequence(ast, input, 0);
  // posAfterMatch is the number of characters consumed since we start at index 0 of the (potentially sliced) input
  return matched && (!mustConsumeAll || posAfterMatch === input.length);
}

// ------------------------ PARSER ------------------------

function parse(pattern) {
  let i = 0;

  function parseQuantifier() {
    if (pattern[i] === "+") return i++, "+";
    if (pattern[i] === "?") return i++, "?";
    return null;
  }

  function parseCharClass() {
    const end = pattern.indexOf("]", i);
    if (end === -1) throw new Error("Unclosed [");
    const content = pattern.slice(i + 1, end);
    const isNegated = content.startsWith("^");
    const chars = isNegated ? content.slice(1) : content;
    i = end + 1;
    const quant = parseQuantifier();
    return { type: "class", chars, negated: isNegated, quant };
  }

  function parseGroup() {
    i++; // skip (
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

    if (pattern[i] !== ")") throw new Error("Unclosed group");
    i++; // skip )
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
        i++;
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

// ------------------------ MATCHER ------------------------

// The matcher uses a recursive backtracking algorithm.
// `matchSequence` attempts to match a sequence of AST nodes.
// `matchAtom` attempts to match a single, non-quantified AST node.
// They are mutually recursive because a group node (an "atom") contains sequences (its options).

function matchSequence(ast, input, pos) {
  // Base case: If the pattern sequence is empty, we have a successful match.
  if (ast.length === 0) {
    return [true, pos];
  }

  const node = ast[0];
  const restOfAST = ast.slice(1);

  if (node.quant === "?") {
    // Optional quantifier: First, try to match the atom (greedy).
    const [atomMatched, atomConsumed] = matchAtom(node, input, pos);
    if (atomMatched) {
      // If the atom matched, try to match the rest of the sequence from the new position.
      const [restMatched, finalPos] = matchSequence(
        restOfAST,
        input,
        pos + atomConsumed
      );
      // If the rest of the sequence also matched, we're done.
      if (restMatched) {
        return [true, finalPos];
      }
    }
    // If matching the atom didn't lead to a full match, try skipping it.
    return matchSequence(restOfAST, input, pos);
  }

  if (node.quant === "+") {
    // One-or-more quantifier: requires backtracking.
    // Greedily match the atom as many times as possible.
    const consumptionPoints = [];
    let currentPos = pos;

    // First, we must match at least once.
    const [firstMatch, firstConsumed] = matchAtom(node, input, currentPos);
    if (!firstMatch || firstConsumed === 0) {
      return [false, pos]; // Failed to match even once.
    }
    currentPos += firstConsumed;
    consumptionPoints.push(currentPos);

    // Now, match greedily for any subsequent occurrences.
    while (true) {
      const [atomMatched, atomConsumed] = matchAtom(node, input, currentPos);
      // Stop if atom doesn't match or if it matches but consumes nothing
      // (to prevent infinite loops on patterns like (a*)+).
      if (!atomMatched || atomConsumed === 0) {
        break;
      }
      currentPos += atomConsumed;
      consumptionPoints.push(currentPos);
    }

    // Backtrack: Try to match the rest of the sequence from each consumption point,
    // starting from the most greedy (last point).
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

    // All backtracking attempts failed.
    return [false, pos];
  }

  // No quantifier: Match a single atom.
  const [atomMatched, atomConsumed] = matchAtom(node, input, pos);
  if (atomMatched) {
    // If it matched, continue with the rest of the sequence.
    return matchSequence(restOfAST, input, pos + atomConsumed);
  }

  return [false, pos];
}

function matchAtom(node, input, pos) {
  // This function handles a single, non-quantified node.
  // It's called by matchSequence.

  if (node.type === "group") {
    // For a group, try each alternative option.
    for (const option of node.options) {
      // An option is a sequence, so we use matchSequence.
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

main();
