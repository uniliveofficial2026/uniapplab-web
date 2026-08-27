import { getAppViewportSnapshot, subscribeAppViewport } from '../safeArea';

export type GreedyHostInsets = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export function readGreedyHostInsets(): GreedyHostInsets {
  const v = getAppViewportSnapshot();
  return {
    top: v.safeTop,
    bottom: v.safeBottom,
    left: v.safeLeft,
    right: v.safeRight,
  };
}

export type GreedyHostInsetOptions = {
  /** Host shell already applies safe-area padding around the iframe — avoid double top inset. */
  hostPaddedTop?: boolean;
};

/** Push measured safe-area insets into the Greedy iframe (env() is often 0 inside iframes). */
export function postGreedyHostInsets(
  post: (payload: Record<string, unknown>) => void,
  options?: GreedyHostInsetOptions,
): GreedyHostInsets {
  const insets = readGreedyHostInsets();
  const hostPadded = Boolean(options?.hostPaddedTop);
  post({
    type: 'host-insets',
    top: hostPadded ? 0 : insets.top,
    bottom: hostPadded ? 0 : insets.bottom,
    left: hostPadded ? 0 : insets.left,
    right: hostPadded ? 0 : insets.right,
    hostPadded,
  });
  return insets;
}

export function subscribeGreedyHostInsets(
  post: (payload: Record<string, unknown>) => void,
  options?: GreedyHostInsetOptions | (() => GreedyHostInsetOptions | undefined),
): () => void {
  return subscribeAppViewport(() => {
    const resolved = typeof options === 'function' ? options() : options;
    postGreedyHostInsets(post, resolved);
  });
}
