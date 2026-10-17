"use client";

/**
 * Downloads of question sound clips, started ahead of time (the server's
 * `preload` hint) and reused when the question opens. Keyed by the URL
 * without its signature, which can differ between the hint and the question.
 */
const cache = new Map<string, Promise<ArrayBuffer>>();
const progress = new Map<
  string,
  { loaded: number; total: number; done: boolean; failed?: boolean }
>();
const MAX_ENTRIES = 12;

const bare = (url: string) => url.split("?")[0]!;

/** Download with byte progress (streams when the body is a stream). */
async function download(url: string, key: string): Promise<ArrayBuffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`clip ${r.status}`);
  const total = Number(r.headers.get("content-length")) || 0;
  progress.set(key, { loaded: 0, total, done: false });
  if (!r.body) {
    const buf = await r.arrayBuffer();
    progress.set(key, {
      loaded: buf.byteLength,
      total: buf.byteLength,
      done: true,
    });
    notify();
    return buf;
  }
  const reader = r.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    progress.set(key, { loaded, total, done: false });
    notify();
  }
  const out = new Uint8Array(loaded);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.byteLength;
  }
  progress.set(key, { loaded, total: total || loaded, done: true });
  notify();
  return out.buffer;
}

/** Tries per clip; between them a random pause that grows with each try. */
const DOWNLOAD_TRIES = 3;

/**
 * A crowd downloading at once makes some requests fail (timeouts, refused
 * connections): try again after a random pause (0.4–1.2 s, then 0.8–2.4 s) so
 * the retries don't all land together. Only then is the clip given up.
 */
async function downloadWithRetry(
  url: string,
  key: string,
): Promise<ArrayBuffer> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await download(url, key);
    } catch (err) {
      if (attempt >= DOWNLOAD_TRIES) throw err;
      await new Promise((r) =>
        setTimeout(r, (400 + Math.random() * 800) * attempt),
      );
    }
  }
}

export function fetchClip(url: string): Promise<ArrayBuffer> {
  const key = bare(url);
  let p = cache.get(key);
  if (!p) {
    p = downloadWithRetry(url, key);
    p.catch(() => {
      cache.delete(key);
      // Report it as finished (not ok, but nothing left to wait for): the
      // server's countdown shouldn't hold the room for this device.
      progress.set(key, { loaded: 0, total: 0, done: true, failed: true });
      notify();
    });
    cache.set(key, p);
    if (cache.size > MAX_ENTRIES) {
      const oldest = cache.keys().next().value!;
      cache.delete(oldest);
      progress.delete(oldest);
    }
  }
  return p;
}

// -- progress reports (`preload-status`, for the countdown's wait) -------------

type Report = {
  qIndex: number;
  loaded: number;
  total: number;
  done: boolean;
  /** A clip failed: done, but it won't play here. */
  failed?: boolean;
};
let tracked: { qIndex: number; keys: string[]; reportedDone?: boolean } | null =
  null;
const listeners = new Set<(r: Report) => void>();

function notify() {
  // "Done" once per question: other downloads (skin sounds, images) keep
  // calling notify, and every report is a store write on the server.
  if (!tracked || tracked.reportedDone) return;
  let loaded = 0;
  let total = 0;
  let done = true;
  let failed = false;
  for (const k of tracked.keys) {
    const p = progress.get(k);
    loaded += p?.loaded ?? 0;
    total += p?.total ?? 0;
    if (!p?.done) done = false;
    if (p?.failed) failed = true;
  }
  if (done) tracked.reportedDone = true;
  const report = {
    qIndex: tracked.qIndex,
    loaded,
    total,
    done,
    ...(failed ? { failed } : {}),
  };
  for (const l of listeners) l(report);
}

/** Subscribe to the tracked question's download progress. */
export function onPreloadProgress(listener: (r: Report) => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** The longest random pause before a device starts its question preload. */
const PRELOAD_SPREAD_MS = 3000;

/**
 * Start downloading clips; with `qIndex` their progress is reported (the
 * server's countdown waits for devices that are downloading). A question's
 * clips start after a random pause of up to PRELOAD_SPREAD_MS, so a full
 * room doesn't hit the server in the same second — the "loaded 0" report
 * goes out at once, so the countdown counts the device as downloading
 * (under the server's 4 s stall limit) rather than as done or stalled.
 */
export function preloadClips(urls: string[], qIndex?: number) {
  const start = () => {
    for (const u of urls) void fetchClip(u).catch(() => undefined);
    notify();
  };
  if (qIndex === undefined) {
    start();
    return;
  }
  tracked = { qIndex, keys: urls.map(bare) };
  notify();
  setTimeout(start, Math.random() * PRELOAD_SPREAD_MS);
}

/** Decrypts a clip (12-byte IV, AES-256-GCM ciphertext + tag) to an object URL. */
export async function decryptClip(
  url: string,
  keyB64: string,
): Promise<string> {
  const plain = await decryptClipBuffer(url, keyB64);
  return URL.createObjectURL(new Blob([plain], { type: "audio/mpeg" }));
}

/** The decrypted clip's bytes (for Web Audio playback). */
export async function decryptClipBuffer(
  url: string,
  keyB64: string,
): Promise<ArrayBuffer> {
  const data = new Uint8Array(await fetchClip(url));
  const raw = Uint8Array.from(
    atob(keyB64.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
    "decrypt",
  ]);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: data.subarray(0, 12) },
    key,
    data.subarray(12),
  );
  return plain;
}
