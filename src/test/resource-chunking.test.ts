import { describe, expect, it } from "vitest";
import {
  chunkResourceText,
  createEmbeddingChunks,
} from "@/lib/resource-chunking";

describe("resource chunking", () => {
  it("tracks chunk indexes and word offsets with overlap", () => {
    const chunks = chunkResourceText("one two three four five six", {
      chunkSize: 3,
      overlap: 1,
    });

    expect(chunks).toHaveLength(3);
    expect(chunks.map((chunk) => chunk.metadata.chunk_index)).toEqual([
      0, 1, 2,
    ]);
    expect(chunks.map((chunk) => chunk.metadata.total_chunks)).toEqual([
      3, 3, 3,
    ]);
    expect(
      chunks.map((chunk) => [
        chunk.metadata.word_start,
        chunk.metadata.word_end,
      ]),
    ).toEqual([
      [0, 2],
      [2, 4],
      [4, 5],
    ]);
  });

  it("carries heading, page, and slide labels into metadata", () => {
    const chunks = chunkResourceText(
      "# Photosynthesis\nPage 2\nalpha beta gamma\nSlide 3: Chloroplasts\ndelta epsilon",
      { chunkSize: 8, overlap: 0 },
    );

    expect(chunks[0]?.metadata.heading).toBe("Photosynthesis");
    expect(chunks[0]?.metadata.page_label).toBe("Page 2");
    expect(chunks[1]?.metadata.slide_label).toBe("Slide 3: Chloroplasts");
  });

  it("merges base metadata without overriding chunk metadata", () => {
    const chunks = createEmbeddingChunks("alpha beta gamma", {
      title: "Biology notes",
      chunk_index: 99,
    });

    expect(chunks[0]?.metadata.title).toBe("Biology notes");
    expect(chunks[0]?.metadata.chunk_index).toBe(0);
  });
});
