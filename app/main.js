function matchPattern(pattern, inputLine) {
  // Try matching from every possible starting index in input
  for (let start = 0; start <= inputLine.length; start++) {
    const slice = inputLine.slice(start);
    if (matchFrom(start, pattern, slice, inputLine.length)) {
      return true;
    }
  }
  return false;
}

// Main pattern matcher
function matchFrom(start, pattern, input, originalLength) {
  let i = 0; // index in input
  let j = 0; // index in pattern

  // Handle ^ anchor
  if (pattern.startsWith("^")) {
    if (start !== 0) return false; // ^ means match only from beginning
    pattern = pattern.slice(1);
  }

  // Handle $ anchor
  let endsWithDollar = false;
  if (pattern.endsWith("$")) {
    endsWithDollar = true;
    pattern = pattern.slice(0, -1);
  }

  while (j < pattern.length) {
    const pChar = pattern[j];
    const nextChar = pattern[j + 1];
    const inputChar = input[i];

    // Escape sequences: \d, \w
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
        return false; // unsupported escape
      }
    }

    // Optional quantifier '?'
    if (nextChar === "?") {
      if (inputChar === pChar) i++; // match 1
      // whether matched or not, move pattern ahead
      j += 2;
      continue;
    }

    // Handle one-or-more quantifier '+'
    if (nextChar === "+") {
      if (inputChar !== pChar) return false;

      let repeatStart = i;
      while (input[i] === pChar) {
        i++;
      }

      // Try to match the rest of the pattern after `+`
      for (let repeatEnd = i; repeatEnd > repeatStart; repeatEnd--) {
        const remainingInput = input.slice(repeatEnd);
        const remainingPattern = pattern.slice(j + 2); // skip char and '+'

        if (matchFrom(0, remainingPattern, remainingInput, originalLength)) {
          return true;
        }
      }

      return false; // couldn't match the rest
    }

    // Character class [abc]
    if (pChar === "[") {
      const closing = pattern.indexOf("]", j);
      if (closing === -1) return false; // Malformed pattern

      const charClass = pattern.slice(j + 1, closing);

      const isNegated = charClass.startsWith("^");
      const chars = isNegated ? charClass.slice(1) : charClass;

      const currentChar = input[i];
      const match = chars.includes(currentChar);

      // If it's a negated class and the char IS in the list => reject
      // If it's a normal class and the char IS NOT in the list => reject
      if ((isNegated && match) || (!isNegated && !match)) {
        return false;
      }

      // Accept the character, move on
      i++;
      j = closing + 1;
      continue;
    }

    // Dot: match any character
    if (pChar === ".") {
      if (inputChar === undefined) return false;
      i++;
      j++;
      continue;
    }

    // Literal match
    if (pChar !== inputChar) return false;
    i++;
    j++;
  }

  // At the end, handle $ anchor: input must be fully consumed
  if (endsWithDollar && i !== input.length) {
    return false;
  }

  return true;
}

// Helper: is input character a digit?
function isDigit(c) {
  return c >= "0" && c <= "9";
}

// Helper: is input character alphanumeric or underscore?
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
