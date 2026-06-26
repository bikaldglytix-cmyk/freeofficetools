/**
 * MetadataWriter — preserves and updates document metadata.
 *
 * Precedence per field: explicit override → document model (`meta`) → source PDF
 * → sensible default. Creation date is preserved from the source (or the model)
 * unless told otherwise; modification date is stamped "now" (or a fixed epoch in
 * deterministic mode). Missing metadata never throws.
 *
 * PASSWORD/ENCRYPTION — FREE-LIBRARY LIMITATION: pdf-lib cannot write encrypted
 * (password-protected) PDFs. If a password is requested we emit an explicit
 * error-severity diagnostic and write the file UNENCRYPTED, so callers can decide
 * whether to fall back to a server-side tool or surface the limitation. (No free
 * pure-JS writer currently produces standards-compliant encrypted PDFs.)
 */
import type { DocumentMeta } from "../model/types";
import { errorMessage } from "./errors";
import type { PDFWriter } from "./pdf-writer";
import type { ExportDiagnostic, MetadataOverrides } from "./types";

const APP_PRODUCER = "FreeOfficeTools PDF Editor (pdf-lib)";
const DETERMINISTIC_DATE = new Date(0); // 1970-01-01T00:00:00Z

export class MetadataWriter {
  write(
    writer: PDFWriter,
    meta: DocumentMeta,
    overrides: MetadataOverrides,
    deterministic: boolean,
    password: string | null,
    diagnostics: ExportDiagnostic[],
  ): void {
    const out = writer.doc;
    const source = writer.sourceDocument;
    const src = source ? readSource(source) : {};

    const title = overrides.title ?? meta.title ?? src.title ?? meta.fileName;
    const author = overrides.author ?? meta.author ?? src.author;
    const subject = overrides.subject ?? src.subject;
    const keywords = overrides.keywords ?? src.keywords;
    const creator = overrides.creator ?? src.creator ?? APP_PRODUCER;
    const producer = overrides.producer ?? APP_PRODUCER;

    try {
      if (title) out.setTitle(title);
      if (author) out.setAuthor(author);
      if (subject) out.setSubject(subject);
      if (keywords && keywords.length) out.setKeywords(keywords);
      out.setCreator(creator);
      out.setProducer(producer);

      const creationDate = deterministic
        ? DETERMINISTIC_DATE
        : overrides.preserveCreationDate
          ? src.creationDate ?? new Date(meta.createdAt)
          : src.creationDate ?? new Date(meta.createdAt);
      out.setCreationDate(creationDate);
      out.setModificationDate(deterministic ? DETERMINISTIC_DATE : new Date());
    } catch (err) {
      diagnostics.push({
        severity: "warning",
        code: "METADATA_WRITE_FAILED",
        message: `Some metadata could not be written: ${errorMessage(err)}`,
      });
    }

    if (password) {
      diagnostics.push({
        severity: "error",
        code: "ENCRYPTION_UNSUPPORTED",
        message:
          "A password was requested but pdf-lib cannot write encrypted PDFs; the file was saved WITHOUT encryption. Use a server-side tool for password protection.",
      });
    }
  }
}

interface SourceMeta {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  creator?: string;
  producer?: string;
  creationDate?: Date;
}

function readSource(source: PDFWriter["sourceDocument"]): SourceMeta {
  if (!source) return {};
  const safe = <T>(fn: () => T): T | undefined => {
    try {
      return fn();
    } catch {
      return undefined;
    }
  };
  const keywordsRaw = safe(() => source.getKeywords());
  return {
    title: safe(() => source.getTitle()) || undefined,
    author: safe(() => source.getAuthor()) || undefined,
    subject: safe(() => source.getSubject()) || undefined,
    keywords: keywordsRaw ? keywordsRaw.split(/[,;]\s*/).filter(Boolean) : undefined,
    creator: safe(() => source.getCreator()) || undefined,
    producer: safe(() => source.getProducer()) || undefined,
    creationDate: safe(() => source.getCreationDate()) || undefined,
  };
}
