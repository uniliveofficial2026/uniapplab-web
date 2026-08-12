import { useEffect, useState } from 'react';

function isValidPortalContainer(node: unknown): node is HTMLElement {
  if (!node || typeof node !== 'object') return false;
  const nodeType = (node as Node).nodeType;
  return nodeType === 1 || nodeType === 9 || nodeType === 11;
}

/** Document body when available and valid for React createPortal. */
export function resolveAppPortalRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const body = document.body;
  return isValidPortalContainer(body) ? body : null;
}

/** Defer portal target until after mount so document.body is guaranteed. */
export function useAppPortalRoot(): HTMLElement | null {
  const [root, setRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setRoot(resolveAppPortalRoot());
  }, []);

  return root;
}
