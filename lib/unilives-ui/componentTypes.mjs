/**
 * UI kit component type stubs — Builder palette maps here; no React exports.
 * Categories align with @unilives/builder palette.
 */

/** @type {Record<string, { componentType: string, label: string, defaultProps?: Record<string, unknown> }[]>} */
export const COMPONENT_PALETTE_STUBS = {
  Layout: [
    { componentType: 'Stack', label: 'Stack', defaultProps: { gap: 8 } },
    { componentType: 'Row', label: 'Row', defaultProps: { gap: 8 } },
    { componentType: 'Column', label: 'Column', defaultProps: { gap: 8 } },
    { componentType: 'ScrollView', label: 'Scroll View' },
    { componentType: 'SafeArea', label: 'Safe Area' },
  ],
  Typography: [
    { componentType: 'Heading', label: 'Heading', defaultProps: { level: 1 } },
    { componentType: 'Text', label: 'Text' },
    { componentType: 'Label', label: 'Label' },
  ],
  Buttons: [
    { componentType: 'Button', label: 'Button', defaultProps: { label: 'Click' } },
    { componentType: 'IconButton', label: 'Icon Button' },
    { componentType: 'Link', label: 'Link' },
  ],
  Inputs: [
    { componentType: 'TextInput', label: 'Text Input', defaultProps: { placeholder: '' } },
    { componentType: 'Checkbox', label: 'Checkbox' },
    { componentType: 'Switch', label: 'Switch' },
  ],
  Auth: [
    { componentType: 'SignInForm', label: 'Sign In Form' },
    { componentType: 'SignUpForm', label: 'Sign Up Form' },
    { componentType: 'AuthGate', label: 'Auth Gate' },
  ],
  Profile: [
    { componentType: 'ProfileHeader', label: 'Profile Header' },
    { componentType: 'ProfileStats', label: 'Profile Stats' },
    { componentType: 'Avatar', label: 'Avatar' },
  ],
  Messaging: [
    { componentType: 'ChatList', label: 'Chat List' },
    { componentType: 'ChatThread', label: 'Chat Thread' },
    { componentType: 'MessageComposer', label: 'Message Composer' },
  ],
  RTC: [
    { componentType: 'CallView', label: 'Call View' },
    { componentType: 'CallControls', label: 'Call Controls' },
    { componentType: 'RtcPreview', label: 'RTC Preview' },
  ],
  Live: [
    { componentType: 'LiveStage', label: 'Live Stage' },
    { componentType: 'LiveChat', label: 'Live Chat' },
    { componentType: 'GiftPanel', label: 'Gift Panel' },
  ],
  Commerce: [
    { componentType: 'ProductGrid', label: 'Product Grid' },
    { componentType: 'ProductCard', label: 'Product Card' },
    { componentType: 'CheckoutForm', label: 'Checkout Form' },
  ],
};

/**
 * @returns {Array<{ category: string, components: typeof COMPONENT_PALETTE_STUBS[string] }>}
 */
export function listComponentPalette() {
  return Object.entries(COMPONENT_PALETTE_STUBS).map(([category, components]) => ({
    category,
    components,
  }));
}

/**
 * @param {string} componentType
 */
export function getComponentStub(componentType) {
  for (const components of Object.values(COMPONENT_PALETTE_STUBS)) {
    const hit = components.find((c) => c.componentType === componentType);
    if (hit) return hit;
  }
  return null;
}
