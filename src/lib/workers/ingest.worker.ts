// Web Worker to process PDF and Word (.docx) files off the main thread
import type { TextContent, TextItem } from "pdfjs-dist/types/src/display/api";

type IngestMessageData = {
  fileType: "pdf" | "docx";
  arrayBuffer: ArrayBuffer;
};

type IngestResponse =
  | { type: "success"; text: string; pageCount?: number }
  | { type: "error"; error: string };

self.onmessage = async (event: MessageEvent<IngestMessageData>) => {
  const { fileType, arrayBuffer } = event.data;

  try {
    if (fileType === "pdf") {
      const pdfjsLib = await import("pdfjs-dist");
      
      // Set worker source using public CDN
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pagesText: string[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        const pageText = textContent.items
          .map((item: any) => {
            if ("str" in item) {
              return item.str;
            }
            return "";
          })
          .join(" ");
        
        pagesText.push(pageText);
      }

      const fullText = pagesText.join("\n\n");
      self.postMessage({ type: "success", text: fullText, pageCount: pdf.numPages } satisfies IngestResponse);
    } else if (fileType === "docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ arrayBuffer });
      self.postMessage({ type: "success", text: result.value } satisfies IngestResponse);
    } else {
      self.postMessage({ type: "error", error: `Unsupported file type: ${fileType}` } satisfies IngestResponse);
    }
  } catch (err: any) {
    self.postMessage({
      type: "error",
      error: err instanceof Error ? err.message : String(err),
    } satisfies IngestResponse);
  }
};
