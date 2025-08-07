#!/usr/bin/env node

function main() {
  const flag = process.argv[2];
  const pattern = process.argv[3];
  const inputLine = require("fs").readFileSync(0, "utf-8").trim();

  if (flag !== "-E") {
    console.error("Expected first argument to be '-E'");
    process.exit(1);
  }

  const anchoredStart = pattern.startsWith("^");
  const anchoredEnd = pattern.endsWith("$");
  const cleanPattern = pattern.replace(/^\^/, "").replace(/\$$/, "");

  if (anchoredStart) {
    if (matchPattern(cleanPattern, inputLine, anchoredEnd)) process.exit(0);
  } else {
    for (let i = 0; i <= inputLine.length; i++) {
      if (matchPattern(cleanPattern, inputLine.slice(i), anchoredEnd)) {
        process.exit(0);
      }
    }
  }

  process.exit(1);
}

function matchPattern(pattern, input, mustConsumeAll) {
  const ast = parse(pattern);
  const [matched, consumed] = matchAST(ast, input, 0);
  return matched && (!mustConsumeAll || consumed === input.length);
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

function matchAST(ast, input, pos) {
  function matchNode(node, input, pos) {
    if (node.quant === "+") {
      let count = 0;
      let newPos = pos;
      while (true) {
        const [matched, consumed] = matchSingle(node, input, newPos);
        if (!matched || consumed === 0) break;
        count++;
        newPos += consumed;
      }
      return count > 0 ? [true, newPos - pos] : [false, 0];
    } else if (node.quant === "?") {
      const [matched, consumed] = matchSingle(node, input, pos);
      return matched ? [true, consumed] : [true, 0];
    } else {
      return matchSingle(node, input, pos);
    }
  }

  function matchSingle(node, input, pos) {
    const char = input[pos];
    if (char === undefined) return [false, 0];

    if (node.type === "char") {
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

    if (node.type === "group") {
      for (const option of node.options) {
        let posTracker = pos;
        let allMatched = true;
        for (const subNode of option) {
          const [matched, consumed] = matchNode(subNode, input, posTracker);
          if (!matched) {
            allMatched = false;
            break;
          }
          posTracker += consumed;
        }
        if (allMatched) return [true, posTracker - pos];
      }
      return [false, 0];
    }

    return [false, 0];
  }

  let posTracker = pos;
  for (const node of ast) {
    const [matched, consumed] = matchNode(node, input, posTracker);
    if (!matched) return [false, posTracker];
    posTracker += consumed;
  }

  return [true, posTracker];
}

main();
