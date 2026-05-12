/**
 * DOCX/PPTX text extraction using JSZip.
 * DOCX/PPTX files are ZIP archives containing XML.
 * We extract text from word/document.xml (DOCX) or ppt/slides/*.xml (PPTX).
 */

import JSZip from "jszip";

export async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(buffer);

    // Try DOCX first (word/document.xml)
    const docXml = zip.file("word/document.xml");
    if (docXml) {
      const xml = await docXml.async("string");
      return extractTextFromXml(xml, "w:t");
    }

    // Try PPTX (ppt/slides/slide*.xml)
    const slideFiles = Object.keys(zip.files)
      .filter((name) => name.match(/^ppt\/slides\/slide\d+\.xml$/))
      .sort();

    if (slideFiles.length > 0) {
      const texts: string[] = [];
      for (const slidePath of slideFiles) {
        const slideXml = await zip.file(slidePath)!.async("string");
        const slideText = extractTextFromXml(slideXml, "a:t");
        if (slideText) texts.push(slideText);
      }
      return texts.join("\n\n");
    }

    return "";
  } catch (err) {
    console.error("DOCX/PPTX extraction error:", err);
    return "";
  }
}

function extractTextFromXml(xml: string, tagName: string): string {
  // Match text content inside the specified tags
  const regex = new RegExp(`<${tagName}[^>]*>([^<]*)<\/${tagName}>`, "g");
  const parts: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(xml)) !== null) {
    if (match[1]) parts.push(match[1]);
  }

  // Also extract paragraph breaks by detecting </w:p> or </a:p>
  // Join with spaces, but add newlines between paragraphs
  const paragraphTag = tagName === "w:t" ? "w:p" : "a:p";
  const paragraphs: string[] = [];
  const paraRegex = new RegExp(`<${paragraphTag}[^>]*>(.*?)<\/${paragraphTag}>`, "gs");
  let paraMatch: RegExpExecArray | null;

  while ((paraMatch = paraRegex.exec(xml)) !== null) {
    const innerTextRegex = new RegExp(`<${tagName}[^>]*>([^<]*)<\/${tagName}>`, "g");
    const innerParts: string[] = [];
    let innerMatch: RegExpExecArray | null;

    while ((innerMatch = innerTextRegex.exec(paraMatch[1])) !== null) {
      if (innerMatch[1]) innerParts.push(innerMatch[1]);
    }

    if (innerParts.length > 0) {
      paragraphs.push(innerParts.join(""));
    }
  }

  if (paragraphs.length > 0) {
    return paragraphs.join("\n").trim();
  }

  // Fallback to simple tag matching
  return parts.join(" ").trim();
}
