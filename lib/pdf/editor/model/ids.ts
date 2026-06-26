/**
 * Id generation. Prefers `crypto.randomUUID` (browsers + Node 18+), with a
 * deterministic-enough fallback so the engine also works in exotic runtimes and
 * unit tests. Ids are prefixed by kind purely to aid debugging/log reading.
 */

let counter = 0;

function randomPart(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  counter = (counter + 1) % Number.MAX_SAFE_INTEGER;
  return `${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function newId(prefix: string): string {
  return `${prefix}_${randomPart()}`;
}

export const newDocumentId = () => newId("doc");
export const newPageId = () => newId("pg");
export const newObjectId = () => newId("obj");
export const newRevisionId = () => newId("rev");
export const newOperationId = () => newId("op");
export const newPatchId = () => newId("patch");
export const newGroupId = () => newId("grp");
