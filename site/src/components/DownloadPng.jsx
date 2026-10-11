import { useRef, useState } from "react";

// The image's code loads when it is first needed (F49): when the button is hovered, focused or pressed; one request,
// asked again after a failure.
let imageCode = null;
const loadImage = () =>
  (imageCode ??= import("../lib/chartImage.js").catch((e) => {
    imageCode = null;
    throw e;
  }));
const preloadImage = () => {
  loadImage().catch(() => {});
};

export const FAILED = "Couldn’t make the image. Try again.";

/**
 * "Download PNG" (the owner's decision 7): saves the chart on screen as a PNG file (lib/chartImage.js). `image(panel)`
 * says what to draw, from the chart panel the button is in: { title, subtitle, chart, legend, fileName }. It does
 * nothing while the panel is busy (the next file loading); focus stays on the button; if the image can't be made, a
 * polite status beside it says so. Copy link's size, so nothing moves.
 */
export default function DownloadPng({ image, busy = false }) {
  const [failed, setFailed] = useState(false);
  const button = useRef(null);
  const working = useRef(false);

  const download = async () => {
    if (busy || working.current) return;
    working.current = true;
    setFailed(false);
    try {
      const { downloadChartImage } = await loadImage();
      await downloadChartImage(image(button.current.closest(".chart-panel")));
    } catch {
      setFailed(true);
    } finally {
      working.current = false;
    }
  };

  return (
    <span className="png-download">
      <button
        ref={button}
        type="button"
        className="btn"
        aria-label="Download PNG of this chart"
        aria-disabled={busy || undefined}
        onPointerEnter={preloadImage}
        onFocus={preloadImage}
        onClick={download}
      >
        Download PNG
      </button>
      {failed && (
        <span className="png-failed" aria-hidden="true">
          {FAILED}
        </span>
      )}
      <span className="visually-hidden" role="status">
        {failed ? FAILED : ""}
      </span>
    </span>
  );
}
