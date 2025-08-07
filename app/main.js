function main() {
  const flag = process.argv[2];
  const pattern = process.argv[3];
  const inputLine = require("fs").readFileSync(0, "utf-8").trim();

  if (flag !== "-E") {
    console.log("Expected first argument to be '-E'");
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

  function parseSequence() {
    const nodes = [];
    while (i < pattern.length && pattern[i] !== ")" && pattern[i] !== "|") {
      if (pattern[i] === "(") {
        i++;
        const group = parseAlternation();
        if (pattern[i] !== ")") throw new Error("Unclosed group");
        i++;
        const quant = parseQuantifier();
        nodes.push({ type: "group", options: group, quant });
      } else if (pattern[i] === "[") {
        const end = pattern.indexOf("]", i);
        if (end === -1) throw new Error("Unclosed [");
        const content = pattern.slice(i + 1, end);
        const isNegated = content.startsWith("^");
        const chars = isNegated ? content.slice(1) : content;
        i = end + 1;
        const quant = parseQuantifier();
        nodes.push({ type: "class", chars, negated: isNegated, quant });
      } else if (pattern[i] === "\\") {
        const code = pattern[i + 1];
        if (!code) throw new Error("Invalid escape");
        i += 2;
        const quant = parseQuantifier();
        nodes.push({ type: "escape", code, quant });
      } else {
        const char = pattern[i++];
        const quant = parseQuantifier();
        nodes.push({ type: "char", char, quant });
      }
    }
    return nodes;
  }

  function parseAlternation() {
    const options = [];
    while (true) {
      const branch = parseSequence();
      options.push(branch);
      if (pattern[i] === "|") {
        i++;
      } else {
        break;
      }
    }
    return options;
  }

  function parseQuantifier() {
    const q = pattern[i];
    if (q === "+" || q === "?") {
      i++;
      return q;
    }
    return null;
  }

  return parseSequence();
}

// ------------------------ MATCHER ------------------------

function matchAST(ast, input, pos) {
  return tryMatchSequence(ast, input, pos);
}

function tryMatchSequence(nodes, input, pos) {
  if (nodes.length === 0) {
    return [true, pos];
  }

  const [first, ...rest] = nodes;

  if (first.quant === "+") {
    let matches = [];
    let currentPos = pos;
    while (true) {
      const [ok, consumed] = matchNode(first, input, currentPos);
      if (!ok) break;
      currentPos += consumed;
      matches.push(currentPos);
    }
    for (let k = matches.length; k > 0; k--) {
      const tryPos = matches[k - 1];
      const [ok, finalPos] = tryMatchSequence(rest, input, tryPos);
      if (ok) return [true, finalPos];
    }
    return [false, pos];
  }

  if (first.quant === "?") {
    const [ok1, cons1] = matchNode(first, input, pos);
    if (ok1) {
      const [okRest, finalPos1] = tryMatchSequence(rest, input, pos + cons1);
      if (okRest) return [true, finalPos1];
    }
    return tryMatchSequence(rest, input, pos);
  }

  const [ok, consumed] = matchNode(first, input, pos);
  return ok ? tryMatchSequence(rest, input, pos + consumed) : [false, pos];
}

function matchNode(node, input, pos) {
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
    return (node.negated ? !match : match) ? [true, 1] : [false, 0];
  }

  if (node.type === "group") {
    for (const option of node.options) {
      const [ok, consumed] = tryMatchSequence(option, input, pos);
      if (ok) return [true, consumed];
    }
    return [false, 0];
  }

  return [false, 0];
}

main();
