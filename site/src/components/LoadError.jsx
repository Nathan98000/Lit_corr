/** A friendly error with a retry button (the technical detail is kept for the curious, visually hidden). */
export default function LoadError({ onRetry, detail }) {
  return (
    <div className="load-error" role="alert">
      <p>We couldn’t load the data. Check your connection and try again.</p>
      <button type="button" className="btn" onClick={onRetry}>
        Try again
      </button>
      {detail && <span className="visually-hidden"> ({detail})</span>}
    </div>
  );
}
