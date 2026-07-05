/**
 * Native keyboard policy: soft keyboard only opens when the user taps a text field.
 * Blocks autoFocus / programmatic .focus() from pulling up the device keyboard.
 */

let lastPointerTarget: EventTarget | null = null;
let lastPointerAt = 0;
let allowTabFocus = false;

function isTextEntry(el: EventTarget | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLInputElement) {
    if (el.readOnly || el.disabled) return false;
    const type = (el.type || 'text').toLowerCase();
    return ![
      'button',
      'checkbox',
      'radio',
      'file',
      'submit',
      'reset',
      'image',
      'hidden',
      'range',
      'color',
    ].includes(type);
  }
  return el.isContentEditable;
}

function gestureTargetsField(field: HTMLElement, gesture: EventTarget | null): boolean {
  if (!(gesture instanceof Element)) return false;
  if (gesture === field || field.contains(gesture) || gesture.contains(field)) return true;
  if (gesture instanceof HTMLLabelElement) {
    const control = gesture.control;
    if (control === field) return true;
  }
  const id = field.id?.trim();
  if (id && gesture.closest(`label[for="${CSS.escape(id)}"]`)) return true;
  return false;
}

function shouldIgnoreField(field: HTMLElement): boolean {
  if (field.getAttribute('aria-hidden') === 'true') return true;
  if (field.tabIndex < 0 && field.hasAttribute('readonly')) return true;
  if (field.dataset.allowProgrammaticFocus === 'true') return true;
  return false;
}

export function installNativeKeyboardPolicy(): void {
  if (typeof document === 'undefined') return;
  if ((window as Window & { __icNativeKeyboardPolicy?: boolean }).__icNativeKeyboardPolicy) {
    return;
  }
  (window as Window & { __icNativeKeyboardPolicy?: boolean }).__icNativeKeyboardPolicy = true;

  document.addEventListener(
    'pointerdown',
    (event) => {
      lastPointerTarget = event.target;
      lastPointerAt = Date.now();
      allowTabFocus = false;
    },
    true,
  );

  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Tab') allowTabFocus = true;
    },
    true,
  );

  document.addEventListener(
    'focusin',
    (event) => {
      const field = event.target;
      if (!isTextEntry(field)) return;
      if (shouldIgnoreField(field)) return;

      // Desktop keyboard navigation.
      if (allowTabFocus) {
        allowTabFocus = false;
        return;
      }

      // User just tapped this field (or its label).
      const recentTap = Date.now() - lastPointerAt < 800;
      if (recentTap && gestureTargetsField(field, lastPointerTarget)) return;

      // Programmatic / autoFocus — dismiss so the native keyboard stays closed.
      field.blur();
    },
    true,
  );
}

/** Optional: mark a field that may receive focus without a direct tap (rare). */
export function allowProgrammaticFocus(el: HTMLElement | null | undefined): void {
  if (!el) return;
  el.dataset.allowProgrammaticFocus = 'true';
}
