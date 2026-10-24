/** `SoundSkin.finalClip`: the encrypted final song and its key. */
export function finalClipOf(raw: unknown): { url: string; key: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const { url, key } = raw as { url?: unknown; key?: unknown };
  return typeof url === "string" && typeof key === "string"
    ? { url, key }
    : null;
}
