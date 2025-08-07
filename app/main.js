// Simple regex matcher CLI
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

// Entry point: try matching from every possible starting index
function matchPattern(pattern, inputLine) {
  for (let start = 0; start <= inputLine.length; start++) {
    const slice = inputLine.slice(start);
    if (matchFrom(start, pattern, slice)) {
      return true;
    }
  }
  return false;
}

// Main pattern matcher
function matchFrom(start, pattern, input) {
  let endsWithDollar = false;

  // Handle start anchor ^
  if (pattern.startsWith("^")) {
    if (start !== 0) return false;
    pattern = pattern.slice(1);
  }

  // Handle end anchor $
  if (pattern.endsWith("$")) {
    endsWithDollar = true;
    pattern = pattern.slice(0, -1);
  }

  return matchFromHelper(pattern, input, endsWithDollar);
}

// Actual matching logic
function matchFromHelper(pattern, input, endsWithDollar) {
  let i = 0; // input index
  let j = 0; // pattern index

  while (j < pattern.length) {
    const pChar = pattern[j];
    const nextChar = pattern[j + 1];
    const inputChar = input[i];

    // Escape sequences
    if (pChar === "\\") {
      const esc = pattern[j + 1];
      if (esc === "d") {
        if (!isDigit(inputChar)) return false;
        i++;
        j += 2;
        continue;
      } else if (esc === "w") {
        if (!isAlphanumeric(inputChar)) return false;
        i++;
        j += 2;
        continue;
      } else {
        return false;
      }
    }

    // Optional '?'
    if (nextChar === "?") {
      if (inputChar === pChar) i++; // match one
      j += 2;
      continue;
    }

    // One or more '+'
    if (nextChar === "+") {
      if (inputChar !== pChar) return false;
      let count = 0;
      while (input[i] === pChar) {
        i++;
        count++;
      }
      if (count === 0) return false;
      j += 2;
      continue;
    }

    // Character class [abc] or [^abc]
    if (pChar === "[") {
      const closing = pattern.indexOf("]", j);
      if (closing === -1) return false;
      const classContent = pattern.slice(j + 1, closing);
      const isNegated = classContent.startsWith("^");
      const chars = isNegated ? classContent.slice(1) : classContent;

      if (inputChar === undefined) return false;
      const match = chars.includes(inputChar);
      if ((isNegated && match) || (!isNegated && !match)) return false;

      i++;
      j = closing + 1;
      continue;
    }

    // Alternation group (cat|dog)
    if (pChar === "(") {
      const closing = pattern.indexOf(")", j);
      if (closing === -1) return false;
      const group = pattern.slice(j + 1, closing); // e.g., cat|dog
      const options = group.split("|");

      let matched = false;
      for (const opt of options) {
        if (input.slice(i, i + opt.length) === opt) {
          i += opt.length;
          j = closing + 1;
          matched = true;
          break;
        }
      }
      if (!matched) return false;
      continue;
    }

    // Dot matches any one character
    if (pChar === ".") {
      if (inputChar === undefined) return false;
      i++;
      j++;
      continue;
    }

    // Exact literal match
    if (pChar !== inputChar) return false;
    i++;
    j++;
  }

  if (endsWithDollar && i !== input.length) {
    return false;
  }

  return i <= input.length;
}

// Helpers
function isDigit(c) {
  return c >= "0" && c <= "9";
}
function isAlphanumeric(c) {
  return /[a-zA-Z0-9_]/.test(c);
}

main();
