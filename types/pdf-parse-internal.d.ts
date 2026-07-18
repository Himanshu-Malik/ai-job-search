declare module 'pdf-parse/lib/pdf-parse.js' {
  export default function pdfParse(
    dataBuffer: Buffer,
    options?: Record<string, unknown>
  ): Promise<{ text?: string }>
}
