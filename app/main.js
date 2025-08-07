function matchPattern(pattern, inputLine) {
  // matches the start of a line
  if (pattern.startsWith("^")) {
    const remainingPattern = pattern.slice(1);

    return inputLine.startsWith(remainingPattern);
  }

  // matches the end of a line
  if (pattern.endsWith("$")) {
    const remainingPattern = pattern.slice(0, -1);

    return inputLine.endsWith(remainingPattern);
  }

  // Slide over the input line from every possible starting index
  for (let start = 0; start < inputLine.length; start++) {
    if (matchFrom(start, pattern, inputLine)) {
      return true; // Found a match
    }
  }
  return false; // No match found
}

function matchFrom(start, pattern, input) {
  let i = start; // Index in input
  let j = 0; // Index in pattern

  while (j < pattern.length && i < input.length) {
    const pChar = pattern[j];

    // \d \w
    if (pChar === "\\") {
      const next = pattern[j + 1];

      console.log("next", next);
      if (next === "d") {
        if (!isDigit(input[i])) return false;
        i++;
        j += 2;
        continue;
      } else if (next === "w") {
        if (!isAlphanumeric(input[i])) return false;
        i++;
        j += 2;
        continue;
      } else {
        return false; // Unsupported escape
      }
    }

    // any charactar
    if (pChar === ".") {
      if (input[i] === undefined) return false;
      i++;
      j++;
    }

    // Match one or more times
    if (pChar === "+") {
      // char to match
      const char = pattern[j - 1];
      // index of char in input
      const targetIndex = input.indexOf(char);
      // char not found
      if (targetIndex === -1) return false;

      if (isQuantifier(char, input, targetIndex)) return true;
      if (!isQuantifier(char, input, targetIndex)) return false;

      // skip to target index
      i = targetIndex + 1;
      j++;
    }

    // [abc]
    if (pChar === "[") {
      const closing = pattern.indexOf("]", j);
      if (closing === -1) return false; // Malformed pattern
      const charClass = pattern.slice(j + 1, closing);

      const isNegated = charClass.startsWith("^");
      const chars = isNegated ? charClass.slice(1) : charClass;

      const match = chars.includes(input[i]);
      if ((isNegated && match) || (!isNegated && !match)) return false;

      i++;
      j = closing + 1;
    } else {
      // Literal character match
      if (pChar !== input[i]) return false;
      i++;
      j++;
    }
  }

  // Entire pattern matched
  return j === pattern.length;
}

function isDigit(c) {
  console.log("d", c);
  return c >= "0" && c <= "9";
}

function isAlphanumeric(c) {
  return /[a-zA-Z0-9_]/.test(c);
}

function isQuantifier(char, input, start) {
  for (let i = start; i < input.length; i++) {
    if (input[i] === char) return true;
  }
  return false;
}

// CLI logic
function main() {
  const flag = process.argv[2];
  const pattern = process.argv[3];
  const inputLine = require("fs").readFileSync(0, "utf-8").trim();

  if (flag !== "-E") {
    console.log("Expected first argument to be '-E'");
    process.exit(1);
  }

  if (matchPattern(pattern, inputLine)) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main();
