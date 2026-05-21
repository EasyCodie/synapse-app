export const RESOURCE_CHUNK_SIZE = 500;
export const RESOURCE_CHUNK_OVERLAP = 50;

type ChunkOptions = {
  chunkSize?: number;
  overlap?: number;
};

export type ResourceChunkMetadata = {
  chunk_index: number;
  total_chunks: number;
  word_start: number;
  word_end: number;
  heading?: string;
  page_label?: string;
  slide_label?: string;
};

export type ResourceTextChunk = {
  content_text: string;
  metadata: ResourceChunkMetadata;
};

type WordToken = {
  value: string;
  heading?: string;
  page_label?: string;
  slide_label?: string;
};

function compactLabel(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 120);
}

function extractHeading(line: string) {
  const markdownHeading = line.match(/^#{1,6}\s+(.+)$/);
  if (markdownHeading?.[1]) return compactLabel(markdownHeading[1]);

  return undefined;
}

function extractPageLabel(line: string) {
  const page = line.match(/^(?:[-\s]*)page\s+(\d+)(?:\s+of\s+\d+)?(?:[-\s]*)$/i);
  if (page?.[1]) return `Page ${page[1]}`;

  return undefined;
}

function extractSlideLabel(line: string) {
  const slide = line.match(/^slide\s+(\d+)(?:\s*[:.-]\s*(.+))?$/i);
  if (!slide?.[1]) return undefined;

  const suffix = slide[2] ? `: ${compactLabel(slide[2])}` : "";
  return `Slide ${slide[1]}${suffix}`;
}

function tokenizeWithLabels(text: string) {
  const tokens: WordToken[] = [];
  let heading: string | undefined;
  let page_label: string | undefined;
  let slide_label: string | undefined;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    heading = extractHeading(line) ?? heading;
    page_label = extractPageLabel(line) ?? page_label;
    slide_label = extractSlideLabel(line) ?? slide_label;

    for (const value of line.split(/\s+/).filter(Boolean)) {
      tokens.push({ value, heading, page_label, slide_label });
    }
  }

  return tokens;
}

function nearestLabel(
  tokens: WordToken[],
  key: "heading" | "page_label" | "slide_label",
) {
  for (let i = 0; i < tokens.length; i++) {
    const value = tokens[i]?.[key];
    if (value) return value;
  }

  return undefined;
}

export function chunkResourceText(
  text: string,
  options: ChunkOptions = {},
): ResourceTextChunk[] {
  const chunkSize = options.chunkSize ?? RESOURCE_CHUNK_SIZE;
  const overlap = options.overlap ?? RESOURCE_CHUNK_OVERLAP;
  const step = Math.max(1, chunkSize - overlap);
  const tokens = tokenizeWithLabels(text);

  if (tokens.length === 0) return [];

  const chunks: ResourceTextChunk[] = [];

  for (let start = 0; start < tokens.length; start += step) {
    const endExclusive = Math.min(start + chunkSize, tokens.length);
    const slice = tokens.slice(start, endExclusive);
    const content = slice.map((token) => token.value).join(" ").trim();

    if (content) {
      chunks.push({
        content_text: content,
        metadata: {
          chunk_index: chunks.length,
          total_chunks: 0,
          word_start: start,
          word_end: endExclusive - 1,
          heading: nearestLabel(slice, "heading"),
          page_label: nearestLabel(slice, "page_label"),
          slide_label: nearestLabel(slice, "slide_label"),
        },
      });
    }

    if (endExclusive === tokens.length) break;
  }

  return chunks.map((chunk) => ({
    ...chunk,
    metadata: {
      ...chunk.metadata,
      total_chunks: chunks.length,
    },
  }));
}

export function createEmbeddingChunks(
  text: string,
  baseMetadata: Record<string, unknown> = {},
  options: ChunkOptions = {},
) {
  return chunkResourceText(text, options).map((chunk) => ({
    content_text: chunk.content_text,
    metadata: {
      ...baseMetadata,
      ...chunk.metadata,
    },
  }));
}
