export function resolveAccessibility(node: { translationKeys?: Record<string, string>; actionIds?: string[] }) {
  const labelKey = node.translationKeys?.accessibilityLabel || node.translationKeys?.label || node.translationKeys?.title || 'common.ok';
  return {
    labelKey,
    role: node.actionIds?.length ? 'button' : 'group',
    focus: node.actionIds?.length ? 'tab' : 'none',
    keyboard: node.actionIds?.length ? 'Enter Space' : 'none',
    touchTarget: '44px',
    contrast: 'AA',
    reducedMotion: 'honor',
  };
}
