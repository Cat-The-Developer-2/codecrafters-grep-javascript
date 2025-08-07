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
function matchFrom(start, pattern, input) {
  let i = 0; // index in input
  let j = 0; // index in pattern

  // Handle (a|b|c) alternation group
  if (pattern.startsWith("(") && pattern.endsWith(")")) {
    const inner = pattern.slice(1, -1);
    const options = inner.split("|");

    for (const word of options) {
      if (input.includes(word)) {
        return true;
      }
    }

    return false;
  }

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
        if (inputChar === undefined || !isDigit(inputChar)) return false;
        i++;
        j += 2;
        continue;
      } else if (esc === "w") {
        if (inputChar === undefined || !isAlphanumeric(inputChar)) return false;
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
      // For .+ (dot plus), we need special handling
      if (pChar === ".") {
        if (inputChar === undefined) return false;

        // Find maximum number of matches (any character)
        let maxMatches = input.length - i;
        if (maxMatches === 0) return false;

        // Try different numbers of matches (backtracking)
        for (let matchCount = maxMatches; matchCount >= 1; matchCount--) {
          const newI = i + matchCount;
          const remainingInput = input.slice(newI);
          const remainingPattern = pattern.slice(j + 2);

          if (
            matchFromHelper(remainingPattern, remainingInput, endsWithDollar)
          ) {
            return true;
          }
        }

        return false;
      }

      // For literal character +
      if (inputChar === undefined || inputChar !== pChar) return false;

      // Find maximum number of matches
      let maxMatches = 0;
      let tempI = i;
      while (tempI < input.length && input[tempI] === pChar) {
        tempI++;
        maxMatches++;
      }

      if (maxMatches === 0) return false;

      // Try different numbers of matches (backtracking)
      // Start from maximum and work backwards to minimum (1)
      for (let matchCount = maxMatches; matchCount >= 1; matchCount--) {
        const newI = i + matchCount;
        const remainingInput = input.slice(newI);
        const remainingPattern = pattern.slice(j + 2);

        if (matchFromHelper(remainingPattern, remainingInput, endsWithDollar)) {
          return true;
        }
      }

      return false;
    }

    // Character class [abc]
    if (pChar === "[") {
      const closing = pattern.indexOf("]", j);
      if (closing === -1) return false; // Malformed pattern

      const charClass = pattern.slice(j + 1, closing);

      const isNegated = charClass.startsWith("^");
      const chars = isNegated ? charClass.slice(1) : charClass;

      const currentChar = input[i];

      // Check if we've reached end of input
      if (currentChar === undefined) return false;

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
    if (pChar === undefined || inputChar === undefined || pChar !== inputChar)
      return false;
    i++;
    j++;
  }

  // At the end, handle $ anchor: input must be fully consumed
  if (endsWithDollar && i !== input.length) {
    return false;
  }

  // Pattern matched successfully - we don't require consuming all input unless $ anchor
  return true;
}

// Helper function for matching without anchors (used by + backtracking)
function matchFromHelper(pattern, input, endsWithDollar) {
  let i = 0; // index in input
  let j = 0; // index in pattern

  while (j < pattern.length) {
    const pChar = pattern[j];
    const nextChar = pattern[j + 1];
    const inputChar = input[i];

    // Escape sequences: \d, \w
    if (pChar === "\\") {
      const esc = pattern[j + 1];

      if (esc === "d") {
        if (inputChar === undefined || !isDigit(inputChar)) return false;
        i++;
        j += 2;
        continue;
      } else if (esc === "w") {
        if (inputChar === undefined || !isAlphanumeric(inputChar)) return false;
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
      if (inputChar === undefined || inputChar !== pChar) return false;

      // Find maximum number of matches
      let maxMatches = 0;
      let tempI = i;
      while (tempI < input.length && input[tempI] === pChar) {
        tempI++;
        maxMatches++;
      }

      if (maxMatches === 0) return false;

      // Try different numbers of matches (backtracking)
      for (let matchCount = maxMatches; matchCount >= 1; matchCount--) {
        const newI = i + matchCount;
        const remainingInput = input.slice(newI);
        const remainingPattern = pattern.slice(j + 2);

        if (matchFromHelper(remainingPattern, remainingInput, endsWithDollar)) {
          return true;
        }
      }

      return false;
    }

    // Character class [abc]
    if (pChar === "[") {
      const closing = pattern.indexOf("]", j);
      if (closing === -1) return false; // Malformed pattern

      const charClass = pattern.slice(j + 1, closing);

      const isNegated = charClass.startsWith("^");
      const chars = isNegated ? charClass.slice(1) : charClass;

      const currentChar = input[i];

      // Check if we've reached end of input
      if (currentChar === undefined) return false;

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
    if (pChar === undefined || inputChar === undefined || pChar !== inputChar)
      return false;
    i++;
    j++;
  }

  // At the end, handle $ anchor: input must be fully consumed
  if (endsWithDollar && i !== input.length) {
    return false;
  }

  // Pattern matched successfully
  return true;
}

// Helper: is input character a digit?
function isDigit(c) {
  return c >= "0" && c <= "9";
}

// Helper: is input character alphanumeric or underscore?
function isAlphanumeric(c) {
  return /^[a-zA-Z0-9_]$/.test(c);
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
