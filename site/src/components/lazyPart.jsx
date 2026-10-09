import { Component, Suspense, lazy, useState } from "react";
import LoadError from "./LoadError.jsx";

/**
 * A part of the site that loads its code when it is first needed (F49): `load` is a dynamic import. The part can be
 * fetched ahead of time with `Part.preload()` (when the browser is idle, or when a link is hovered); once its code
 * has arrived it renders at once, without a placeholder. If the code cannot be loaded, the next attempt fetches it
 * again.
 */
export function lazyPart(load) {
  let promise = null;
  let Loaded = null;
  let Lazy = null;
  const fetchPart = () => {
    promise ??= load().then(
      (m) => {
        Loaded = m.default;
        return m;
      },
      (e) => {
        promise = null;
        Lazy = lazy(fetchPart);
        throw e;
      },
    );
    return promise;
  };
  Lazy = lazy(fetchPart);
  function Part(props) {
    // decided once per mount, so a part never swaps its component (and loses its state) when the code arrives
    const [Shown] = useState(() => Loaded || Lazy);
    return <Shown {...props} />;
  }
  Part.preload = () => {
    fetchPart().catch(() => {});
  };
  Part.isLoaded = () => Loaded != null;
  return Part;
}

/** Shows `fallback` while a part's code is on its way, and a friendly error with a retry if it could not load. */
export class PartBoundary extends Component {
  state = { failed: false, attempt: 0 };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    const { fallback, children } = this.props;
    if (this.state.failed) {
      return <LoadError onRetry={() => this.setState((s) => ({ failed: false, attempt: s.attempt + 1 }))} />;
    }
    return (
      <Suspense key={this.state.attempt} fallback={fallback}>
        {children}
      </Suspense>
    );
  }
}

/** Run `task` once the browser is idle (or after a short wait where idle callbacks are not supported). */
export function whenIdle(task) {
  if (typeof window === "undefined") return () => {};
  if (window.requestIdleCallback) {
    const id = window.requestIdleCallback(task, { timeout: 3000 });
    return () => window.cancelIdleCallback?.(id);
  }
  const id = setTimeout(task, 300);
  return () => clearTimeout(id);
}
