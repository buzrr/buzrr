/**
 * Fades an <audio> out, then pauses it. iOS Safari ignores `volume` (it is
 * read-only there), so the pause must not depend on the fade: it happens
 * after the fade time no matter what the volume did.
 */
export function fadeOutAndPause(audio: HTMLAudioElement, ms = 300) {
  const step = 40;
  const start = audio.volume;
  const fade = setInterval(() => {
    audio.volume = Math.max(0, audio.volume - start / (ms / step));
  }, step);
  setTimeout(() => {
    clearInterval(fade);
    audio.pause();
  }, ms);
}
