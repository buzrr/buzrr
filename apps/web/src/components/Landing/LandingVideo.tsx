import LandingVideoPlayer from "./LandingVideoPlayer";

/**
 * Product video on the landing page. The MP4 URL comes from
 * `LANDING_VIDEO_URL` (server-side, read at render); unset or not an http(s)
 * URL hides the section. The file is served as uploaded — upload it at 1080p;
 * any Cloudinary transformation re-encodes it at a lower bitrate.
 */
export default function LandingVideo() {
  const src = videoUrl(process.env.LANDING_VIDEO_URL);
  if (!src) return null;

  return (
    <section className="mt-14">
      <h2 className="text-center text-2xl sm:text-3xl font-black text-dark dark:text-white">
        See Buzrr in action
      </h2>
      <div className="mt-8">
        <LandingVideoPlayer src={src} poster={cloudinaryPoster(src)} />
      </div>
    </section>
  );
}

function videoUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

/** First frame as a JPEG, when the video is a Cloudinary upload. */
function cloudinaryPoster(src: string): string | undefined {
  if (!/^https:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\//.test(src)) {
    return undefined;
  }
  return src
    .replace("/video/upload/", "/video/upload/so_0/")
    .replace(/\.[a-z0-9]+(\?.*)?$/i, ".jpg");
}
