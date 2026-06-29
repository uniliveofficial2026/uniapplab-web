import type { Ref, RefCallback } from 'react';

/** Assign one DOM node to multiple React refs. */
export function mergeRefs<T>(...refs: Array<Ref<T> | undefined>): RefCallback<T> {
  return (value) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === 'function') {
        ref(value);
      } else {
        (ref as { current: T | null }).current = value;
      }
    }
  };
}
