/**
 * Parse WEB_ORIGIN for Nest `enableCors` / Socket.IO `cors.origin`.
 * Empty or undefined → reflect all origins (same as `true` in Nest).
 */
export function parseCorsOrigin(raw?: string): boolean | string | string[] {
  const trimmed = raw?.trim();
  if (trimmed === undefined || trimmed === "") {
    return true;
  }
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  if (trimmed.includes(",")) {
    return trimmed
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return trimmed;
}
