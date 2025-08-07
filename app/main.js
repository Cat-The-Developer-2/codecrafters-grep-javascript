function matchPattern(pattern, inputLine) {
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

    if (pChar === "\\") {
      const next = pattern[j + 1];

      if (next === "d") {
        if (!isDigit(input[i])) return false;
        i++;
        j += 2;
      } else if (next === "w") {
        if (!isAlphanumeric(input[i])) return false;
        i++;
        j += 2;
      } else {
        return false; // Unsupported escape
      }
    } else if (pChar === ".") {
      if (input[i] === undefined) return false;
      i++;
      j++;
    } else if (pChar === "[") {
      const closing = pattern.indexOf("]", j);
      if (closing === -1) return false; // Malformed
      const charClass = pattern.slice(j + 1, closing);
      if (!charClass.includes(input[i])) return false;
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
  return c >= "0" && c <= "9";
}

function isAlphanumeric(c) {
  return /[a-zA-Z0-9_]/.test(c);
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
