/**
 * Simple DOCX/PPTX text extraction.
 * DOCX/PPTX files are ZIP archives with XML inside.
 * We extract raw text by finding XML text nodes.
 */

export async function extractDocxText(buffer: Buffer): Promise<string> {
  // DOCX files are ZIP files. The main content is in word/document.xml
  // We'll use a simple approach: find all text between XML tags
  const text = buffer.toString("utf-8");

  // Extract text content between <w:t> tags (Word) or <a:t> tags (PowerPoint)
  const matches = text.match(/<(?:w:t|a:t)[^>]*>([^<]*)<\/(?:w:t|a:t)>/g);

  if (!matches || matches.length === 0) {
    // Fallback: strip all XML tags and return visible text
    return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  return matches
    .map((match) => {
      const content = match.replace(/<[^>]+>/g, "");
      return content;
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
