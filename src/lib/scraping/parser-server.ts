import mammoth from "mammoth";

/**
 * Parses a DOCX file on the server.
 */
export async function parseDocxServer(arrayBuffer: ArrayBuffer): Promise<string> {
  const buffer = Buffer.from(arrayBuffer);
  const { value } = await mammoth.extractRawText({ buffer });
  return value;
}

/**
 * Parses a PDF file on the server using pdfjs-dist.
 */
export async function parsePdfServer(arrayBuffer: ArrayBuffer): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: false,
    disableFontFace: true,
  });
  
  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const text = tc.items
      .map((item: any) => item.str || "")
      .join(" ");
    pages.push(text);
  }

  return pages.join("\n\n");
}

/**
 * Dispatches parsing based on file type.
 */
export async function parseAttachmentServer(
  arrayBuffer: ArrayBuffer,
  fileName: string
): Promise<string> {
  const ext = fileName.split(".").pop()?.toLowerCase();
  
  if (ext === "docx" || ext === "doc") {
    return parseDocxServer(arrayBuffer);
  } else if (ext === "pdf") {
    return parsePdfServer(arrayBuffer);
  } else {
    // Plain text or fallback
    const enc = new TextDecoder("utf-8");
    return enc.decode(arrayBuffer);
  }
}
