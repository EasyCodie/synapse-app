import { describe, expect, it } from "vitest";
import {
  extractGoogleDocumentPlainText,
  parseGoogleDocumentId,
} from "@/lib/google-drive";

describe("Google Drive helpers", () => {
  it("parses Google document ids from common link shapes", () => {
    expect(
      parseGoogleDocumentId(
        "https://docs.google.com/document/d/doc_123-abc/edit",
      ),
    ).toBe("doc_123-abc");
    expect(
      parseGoogleDocumentId("https://drive.google.com/open?id=doc_123-abc"),
    ).toBe("doc_123-abc");
  });

  it("extracts readable text from Google Docs paragraphs and tables", () => {
    const text = extractGoogleDocumentPlainText({
      title: "Biology notes",
      body: {
        content: [
          {
            paragraph: {
              elements: [
                { textRun: { content: "Photosynthesis" } },
                { textRun: { content: "\n" } },
              ],
            },
          },
          {
            table: {
              tableRows: [
                {
                  tableCells: [
                    {
                      content: [
                        {
                          paragraph: {
                            elements: [{ textRun: { content: "Reactants" } }],
                          },
                        },
                      ],
                    },
                    {
                      content: [
                        {
                          paragraph: {
                            elements: [
                              { textRun: { content: "Products" } },
                              { textRun: { content: "\n" } },
                            ],
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    });

    expect(text).toBe("Photosynthesis\nReactants\tProducts");
  });
});
