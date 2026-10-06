"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="page empty">
      <h1>Connection interrupted.</h1>
      <p>We couldn’t load this view. Your saved data has not been changed.</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
