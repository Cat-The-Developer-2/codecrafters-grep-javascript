function matchPattern(inputLine, pattern) {
  if (pattern === "\\d") {
    return matchDigit(inputLine);
  }

  if (pattern === "\\w") {
    return matchAlphanumeric(inputLine);
  }

  if (pattern.startsWith("[") && pattern.endsWith("]")) {
    return positiveCharacter(inputLine, pattern);
  }

  if (pattern.length === 1) {
    return inputLine.includes(pattern);
  } else {
    throw new Error(`Unhandled pattern ${pattern}`);
  }
}

function matchDigit(inputLine) {
  const regex = /\d/;
  return regex.test(inputLine);
}

function matchAlphanumeric(inputLine) {
  const regex = /[a-zA-Z0-9_]/;
  return regex.test(inputLine);
}

function positiveCharacter(inputLine, pattern) {
  const regex = new RegExp(`[${pattern.slice(1, -1)}]`);

  return regex.test(inputLine);
}

function main() {
  const pattern = process.argv[3];
  const inputLine = require("fs").readFileSync(0, "utf-8").trim();

  if (process.argv[2] !== "-E") {
    console.log("Expected first argument to be '-E'");
    process.exit(1);
  }

  if (matchPattern(inputLine, pattern)) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main();
