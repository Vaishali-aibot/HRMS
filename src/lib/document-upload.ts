// Shared constraints for onboarding document uploads. Kept separate from
// the Server Action so the same limits can be surfaced in the upload form's
// UI copy without duplicating the numbers.

export const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB
export const MAX_FILE_SIZE_LABEL = "8MB";

export const ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const ALLOWED_CONTENT_TYPES_LABEL = "PDF, JPEG, PNG, or WebP";

export function validateUploadedFile(file: File): string | null {
  if (file.size === 0) {
    return "Please choose a file.";
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File is too large — the limit is ${MAX_FILE_SIZE_LABEL}.`;
  }
  if (!ALLOWED_CONTENT_TYPES.includes(file.type as (typeof ALLOWED_CONTENT_TYPES)[number])) {
    return `Unsupported file type — please upload a ${ALLOWED_CONTENT_TYPES_LABEL} file.`;
  }
  return null;
}
