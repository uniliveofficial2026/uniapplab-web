import type { AdminUiPickSelection } from './adminUiPickProtocol';

const PICK_ATTRS = ['data-resource-id', 'data-node-id', 'data-component'] as const;

export type AdminUiPickKind =
  | 'text'
  | 'icon'
  | 'button'
  | 'input'
  | 'image'
  | 'video'
  | 'link'
  | 'container'
  | 'frame'
  | 'screen'
  | 'body'
  | 'element';

function labelFromElement(el: Element): string {
  const aria = el.getAttribute('aria-label')?.trim();
  if (aria) return aria;
  const title = el.getAttribute('title')?.trim();
  if (title) return title;
  const alt = el.getAttribute('alt')?.trim();
  if (alt) return alt;
  const placeholder = el.getAttribute('placeholder')?.trim();
  if (placeholder) return placeholder;
  const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
  if (text && text.length <= 80) return text;
  if (text) return `${text.slice(0, 77)}…`;
  return el.tagName.toLowerCase();
}

function domPath(el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur !== document.documentElement && parts.length < 10) {
    const id = cur.id ? `#${cur.id}` : '';
    const tag = cur.tagName.toLowerCase();
    const nodeId = cur.getAttribute('data-node-id');
    const component = cur.getAttribute('data-component');
    if (nodeId) {
      parts.unshift(`${tag}[${nodeId}]`);
      break;
    }
    if (component) {
      parts.unshift(`${tag}[${component}]`);
      break;
    }
    let nth = '';
    if (cur.parentElement) {
      const siblings = [...cur.parentElement.children].filter((c) => c.tagName === cur!.tagName);
      if (siblings.length > 1) {
        const idx = siblings.indexOf(cur) + 1;
        nth = `:nth-of-type(${idx})`;
      }
    }
    parts.unshift(`${tag}${id}${nth}`);
    cur = cur.parentElement;
  }
  return parts.join(' › ');
}

function findUnilivesAttr(el: Element): string | null {
  for (const attr of el.attributes) {
    if (attr.name.startsWith('data-unilives-')) return attr.name;
  }
  return null;
}

function classifyKind(el: Element): AdminUiPickKind {
  const tag = el.tagName.toLowerCase();
  if (tag === 'body') return 'body';
  if (tag === 'html') return 'screen';
  if (tag === 'svg' || el.closest('svg') === el) return 'icon';
  if (el.matches('button, [role="button"], input[type="button"], input[type="submit"], input[type="reset"]')) {
    return 'button';
  }
  if (el.matches('a[href], [role="link"]')) return 'link';
  if (el.matches('input, textarea, select, [contenteditable="true"]')) return 'input';
  if (el.matches('img, picture')) return 'image';
  if (el.matches('video, canvas')) return 'video';
  if (
    el.matches(
      'p, span, h1, h2, h3, h4, h5, h6, label, li, td, th, figcaption, time, small, strong, em, b, i, code, pre',
    )
  ) {
    return 'text';
  }
  if (el.matches('main, [role="main"], [data-screen], [data-app-screen]')) return 'screen';
  if (el.matches('iframe, dialog, [role="dialog"], [data-frame], [data-sheet]')) return 'frame';
  if (el.matches('section, article, aside, nav, header, footer, form, ul, ol, figure, fieldset')) {
    return 'container';
  }
  if (tag === 'div' || tag === 'section' || (el as HTMLElement).childElementCount > 0) return 'container';
  return 'element';
}

function refineTarget(start: Element): Element {
  let el: Element = start;
  if (el.closest('[data-admin-ui-pick-overlay]')) return el;

  // Icon clicks on <path>/<g> → svg root
  const svg = el.closest('svg');
  if (svg && el !== svg) el = svg;

  // Prefer the concrete control when clicking nested label/span inside a button/link
  const control = el.closest('button, a[href], [role="button"], [role="tab"], label, summary');
  if (control && control !== document.body) {
    // Keep micro text/icon if the click was directly on a meaningful child with its own box
    const tag = el.tagName.toLowerCase();
    if (!(tag === 'svg' || tag === 'img' || tag === 'span' || tag === 'i' || tag === 'strong' || tag === 'em')) {
      el = control;
    }
  }

  return el;
}

function harvestIds(el: Element): Pick<AdminUiPickSelection, 'resourceId' | 'nodeId' | 'componentId' | 'unilivesAttr'> {
  let resourceId: string | null = null;
  let nodeId: string | null = null;
  let componentId: string | null = null;
  let unilivesAttr: string | null = null;
  let cur: Element | null = el;
  while (cur && cur !== document.documentElement) {
    if (!resourceId) resourceId = cur.getAttribute('data-resource-id');
    if (!nodeId) nodeId = cur.getAttribute('data-node-id');
    if (!componentId) componentId = cur.getAttribute('data-component');
    if (!unilivesAttr) unilivesAttr = findUnilivesAttr(cur);
    if (resourceId && nodeId && componentId && unilivesAttr) break;
    cur = cur.parentElement;
  }
  return { resourceId, nodeId, componentId, unilivesAttr };
}

/**
 * Cursor-style micro pick: deepest meaningful node under the pointer
 * (button, icon, text, container, body, frame, screen, …).
 */
export function resolvePickTarget(start: Element | null): AdminUiPickSelection | null {
  if (!start) return null;
  if (start.closest?.('[data-admin-ui-pick-overlay]')) return null;

  let el = refineTarget(start);
  if (el === document.documentElement) {
    el = document.body || el;
  }

  const rect = el.getBoundingClientRect();
  if (rect.width < 0.5 && rect.height < 0.5 && el.parentElement) {
    el = el.parentElement;
  }

  const kind = classifyKind(el);
  const ids = harvestIds(el);
  const finalRect = el.getBoundingClientRect();
  const rawLabel = labelFromElement(el);
  const label = `${kind} · ${rawLabel}`;

  return {
    ...ids,
    kind,
    tagName: el.tagName.toLowerCase(),
    label,
    className: typeof (el as HTMLElement).className === 'string' ? (el as HTMLElement).className : undefined,
    rect: {
      top: finalRect.top,
      left: finalRect.left,
      width: finalRect.width,
      height: finalRect.height,
    },
    domPath: domPath(el),
  };
}

export function resourceIdCandidates(pick: AdminUiPickSelection): string[] {
  const out: string[] = [];
  const push = (id?: string | null) => {
    const trimmed = String(id || '').trim();
    if (trimmed && !out.includes(trimmed)) out.push(trimmed);
  };

  push(pick.resourceId);
  push(pick.nodeId);

  if (pick.componentId) {
    const raw = pick.componentId.trim();
    push(raw);
    push(`component.${raw}`);
    const noVersion = raw.replace(/\.v\d+(\.\d+)*$/i, '');
    push(noVersion);
    push(`component.${noVersion}`);
  }

  if (pick.unilivesAttr) {
    const slug = pick.unilivesAttr.replace(/^data-unilives-/, '').replace(/-/g, '.');
    push(`element.${slug}`);
    push(`component.${slug}`);
  }

  return out;
}

export function selectorForPick(pick: AdminUiPickSelection): string | null {
  const esc = (value: string) =>
    typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(value) : value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  if (pick.nodeId) return `[data-node-id="${esc(pick.nodeId)}"]`;
  if (pick.resourceId) return `[data-resource-id="${esc(pick.resourceId)}"]`;
  if (pick.componentId) return `[data-component="${esc(pick.componentId)}"]`;
  if (pick.unilivesAttr) return `[${pick.unilivesAttr}]`;
  return null;
}

export function readPickAttrs(el: Element): Partial<AdminUiPickSelection> {
  for (const name of PICK_ATTRS) {
    const value = el.getAttribute(name);
    if (value) {
      if (name === 'data-resource-id') return { resourceId: value };
      if (name === 'data-node-id') return { nodeId: value };
      if (name === 'data-component') return { componentId: value };
    }
  }
  const unilives = findUnilivesAttr(el);
  return unilives ? { unilivesAttr: unilives } : {};
}
