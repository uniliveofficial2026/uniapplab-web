# Keyboard System

## Strategy (ONE)

Capacitor: `KeyboardResize.None` + `setScroll({ isDisabled: true })`

On `keyboardWillShow` / `keyboardDidShow`: `setNativeKeyboardHeight(event.keyboardHeight)`  
On hide: `clearNativeKeyboardHeight()`

Web/PWA fallback: `visualViewport` bottom inset.

## Composers

Messages, Live footer, Call overlay use `--app-composer-bottom-inset`.

## Policy

`installNativeKeyboardPolicy` still blocks programmatic autoFocus keyboard opens (unchanged).
