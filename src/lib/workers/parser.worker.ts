import * as Comlink from "comlink";

export type ParseResult = {
  text: string;
  metadata: { pageCount?: number; wordCount: number; charCount: number };
};

export type ParserWorkerAPI = {
  parsePdf(arrayBuffer: ArrayBuffer): Promise<ParseResult>;
  parseDocx(arrayBuffer: ArrayBuffer): Promise<ParseResult>;
  parseText(text: string): ParseResult;
};

const api: ParserWorkerAPI = {
  async parsePdf(arrayBuffer) {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      pages.push(
        tc.items
          .map((item: unknown) =>
            typeof item === "object" && item !== null && "str" in item
              ? (item as { str: string }).str
              : ""
          )
          .join(" ")
      );
    }

    const text = pages.join("\n\n");
    return {
      text,
      metadata: {
        pageCount: pdf.numPages,
        wordCount: text.split(/\s+/).filter(Boolean).length,
        charCount: text.length,
      },
    };
  },

  async parseDocx(arrayBuffer) {
    const mammoth = await import("mammoth");
    const { value: text } = await mammoth.extractRawText({ arrayBuffer });
    return {
      text,
      metadata: {
        wordCount: text.split(/\s+/).filter(Boolean).length,
        charCount: text.length,
      },
    };
  },

  parseText(text) {
    return {
      text,
      metadata: {
        wordCount: text.split(/\s+/).filter(Boolean).length,
        charCount: text.length,
      },
    };
  },
};

Comlink.expose(api);
