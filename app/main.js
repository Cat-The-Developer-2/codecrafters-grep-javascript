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
  const [matched, consumed] = matchAST(ast, input, 0, 0);
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

function matchAST(ast, input, pos, startIdx = 0) {
  let posTracker = pos;
  for (let i = startIdx; i < ast.length; i++) {
    const [matched, consumed] = matchNode(ast, i, input, posTracker);
    if (!matched) return [false, posTracker - pos];
    posTracker += consumed;
  }
  return [true, posTracker - pos];
}

function matchNode(ast, index, input, pos) {
  const node = ast[index];

  if (node.quant === "+") {
    let totalConsumed = 0;
    let positions = [];

    const [firstMatch, firstConsumed] = matchSingle(node, input, pos);
    if (!firstMatch) return [false, 0];
    totalConsumed += firstConsumed;
    positions.push(totalConsumed);

    let currentPos = pos + firstConsumed;
    while (true) {
      const [matched, consumed] = matchSingle(node, input, currentPos);
      if (!matched) break;
      currentPos += consumed;
      totalConsumed += consumed;
      positions.push(totalConsumed);
    }

    for (let i = positions.length - 1; i >= 0; i--) {
      const [matchedRest, consumedRest] = matchAST(
        ast,
        input,
        pos + positions[i],
        index + 1
      );
      if (matchedRest) return [true, positions[i] + consumedRest];
    }

    return [false, 0];
  }

  if (node.quant === "?") {
    const [matched, consumed] = matchSingle(node, input, pos);
    if (matched) {
      const [matchedRest, consumedRest] = matchAST(
        ast,
        input,
        pos + consumed,
        index + 1
      );
      if (matchedRest) return [true, consumed + consumedRest];
    }

    const [matchedRest, consumedRest] = matchAST(ast, input, pos, index + 1);
    return matchedRest ? [true, consumedRest] : [false, 0];
  }

  const [matched, consumed] = matchSingle(node, input, pos);
  if (!matched) return [false, 0];

  const [matchedRest, consumedRest] = matchAST(
    ast,
    input,
    pos + consumed,
    index + 1
  );
  return matchedRest ? [true, consumed + consumedRest] : [false, 0];
}

function matchSingle(node, input, pos) {
  const char = input[pos];
  if (char === undefined) return [false, 0];

  if (node.type === "char") {
    if (node.char === ".") return [true, 1]; // wildcard
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
        const [matched, consumed] = matchNode(
          option,
          option.indexOf(subNode),
          input,
          posTracker
        );
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

main();
