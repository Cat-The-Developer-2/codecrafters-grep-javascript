function matchPattern(inputLine, pattern) {
  if (pattern === "\\d") {
    return matchDigit(inputLine);
  }

  if (pattern === "\\w") {
    return matchAlphanumeric(inputLine);
  }

  if (pattern.length === 1) {
    return inputLine.includes(pattern);
  } else {
    throw new Error(`Unhandled pattern ${pattern}`);
  }
}

function matchDigit(inputLine) {
  const regex = /\d/;
  const hasDigit = regex.test(inputLine);

  return hasDigit;
}

function matchAlphanumeric(inputLine) {
  const regex = /[a-zA-Z0-9_]/;
  const isAlphanumeric = regex.test(inputLine);

  return isAlphanumeric;
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
