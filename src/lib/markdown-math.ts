const DISPLAY_OPEN = "\\[";
const DISPLAY_CLOSE = "\\]";
const INLINE_OPEN = "\\(";
const INLINE_CLOSE = "\\)";

function startsWithFence(text: string, index: number) {
  const atLineStart = index === 0 || text[index - 1] === "\n";
  return atLineStart && (text.startsWith("```", index) || text.startsWith("~~~", index));
}

function findLineEnd(text: string, index: number) {
  const newlineIndex = text.indexOf("\n", index);
  return newlineIndex === -1 ? text.length : newlineIndex + 1;
}

function findClosingDelimiter(text: string, delimiter: string, startIndex: number) {
  let index = startIndex;

  while (index < text.length) {
    const nextIndex = text.indexOf(delimiter, index);
    if (nextIndex === -1) return -1;
    if (text[nextIndex - 1] !== "\\") return nextIndex;
    index = nextIndex + delimiter.length;
  }

  return -1;
}

function convertMathDelimiters(text: string) {
  let output = "";
  let index = 0;

  while (index < text.length) {
    if (text.startsWith(DISPLAY_OPEN, index)) {
      const closeIndex = findClosingDelimiter(text, DISPLAY_CLOSE, index + DISPLAY_OPEN.length);

      if (closeIndex !== -1) {
        output += `$$${text.slice(index + DISPLAY_OPEN.length, closeIndex)}$$`;
        index = closeIndex + DISPLAY_CLOSE.length;
        continue;
      }
    }

    if (text.startsWith(INLINE_OPEN, index)) {
      const closeIndex = findClosingDelimiter(text, INLINE_CLOSE, index + INLINE_OPEN.length);

      if (closeIndex !== -1) {
        output += `$${text.slice(index + INLINE_OPEN.length, closeIndex)}$`;
        index = closeIndex + INLINE_CLOSE.length;
        continue;
      }
    }

    output += text[index];
    index += 1;
  }

  return output;
}

export function normalizeMarkdownMath(text: string) {
  let output = "";
  let plainText = "";
  let index = 0;
  let inlineCodeFence = "";
  let blockCodeFence = "";

  function flushPlainText() {
    if (!plainText) return;
    output += convertMathDelimiters(plainText);
    plainText = "";
  }

  while (index < text.length) {
    if (blockCodeFence) {
      const lineEnd = findLineEnd(text, index);
      const line = text.slice(index, lineEnd);
      output += line;

      if (line.startsWith(blockCodeFence)) {
        blockCodeFence = "";
      }

      index = lineEnd;
      continue;
    }

    if (!inlineCodeFence && startsWithFence(text, index)) {
      flushPlainText();
      blockCodeFence = text.startsWith("```", index) ? "```" : "~~~";
      const lineEnd = findLineEnd(text, index);
      output += text.slice(index, lineEnd);
      index = lineEnd;
      continue;
    }

    if (text[index] === "`") {
      const tickMatch = text.slice(index).match(/^`+/);
      const tickFence = tickMatch?.[0] ?? "`";

      if (inlineCodeFence) {
        output += tickFence;
        index += tickFence.length;

        if (tickFence === inlineCodeFence) {
          inlineCodeFence = "";
        }
      } else {
        flushPlainText();
        inlineCodeFence = tickFence;
        output += tickFence;
        index += tickFence.length;
      }

      continue;
    }

    if (inlineCodeFence) {
      output += text[index];
    } else {
      plainText += text[index];
    }

    index += 1;
  }

  flushPlainText();
  return output;
}
