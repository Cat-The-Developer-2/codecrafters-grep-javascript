function matchPattern(pattern, inputLine) {
  const maxStart = inputLine.length - pattern.length + 1;

  // runs startwiths
  // if (pattern[0] === "^") {
  //   const startWithChar = pattern.slice(1);
  //   return inputLine.startsWith(startWithChar);
  // }
  // runs combining char class
  for (let start = 0; start < maxStart; start++) {
    if (matchFrom(start, pattern, inputLine)) {
      return true; // Found a match
    }
  }

  return false; // No match anywhere
}

// combining character class
function matchFrom(start, pattern, input) {
  let i = start;
  let j = 0;

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
        return false; // Unknown escape
      }
    } else if (pChar === "[") {
      const closing = pattern.indexOf("]", j);
      if (closing === -1) return false; // Malformed pattern
      const charClass = pattern.slice(j + 1, closing);
      if (!charClass.includes(input[i])) return false;
      i++;
      j = closing + 1;
    } else if (pChar === ".") {
      if (input[i] === undefined) return false;
      i++;
      j++;
    } else {
      // literal character match
      if (pChar !== input[i]) return false;
      i++;
      j++;
    }
  }

  // Full pattern matched
  return j === pattern.length;
}

function isDigit(c) {
  return c >= "0" && c <= "9";
}

function isAlphanumeric(c) {
  return /[a-zA-Z0-9_]/.test(c);
}

// CLI main logic
function main() {
  const pattern = process.argv[3];
  const inputLine = require("fs").readFileSync(0, "utf-8").trim();

  if (process.argv[2] !== "-E") {
    console.log("Expected first argument to be '-E'");
    process.exit(1);
  }

  if (matchPattern(pattern, inputLine)) {
    process.exit(0); // Match found
  } else {
    process.exit(1); // No match
  }
}

main();
