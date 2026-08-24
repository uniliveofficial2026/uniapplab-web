/* generated — do not edit */
export const CONTRACT_RECORDS = [
  {
    "id": "contract.text.plain.v1",
    "name": "Plain Text",
    "kind": "text",
    "fields": [
      "nodeId",
      "contentId",
      "translationKey",
      "semanticRole"
    ]
  },
  {
    "id": "contract.text.heading.v1",
    "name": "Heading Text",
    "kind": "text",
    "fields": [
      "nodeId",
      "contentId",
      "translationKey",
      "semanticRole"
    ]
  },
  {
    "id": "contract.text.link.v1",
    "name": "Link Text",
    "kind": "text",
    "fields": [
      "nodeId",
      "contentId",
      "translationKey",
      "actionId"
    ]
  },
  {
    "id": "contract.button.action.v1",
    "name": "Action Button",
    "kind": "button",
    "fields": [
      "nodeId",
      "labelKey",
      "accessibilityLabelKey",
      "iconAssetId",
      "state",
      "actionId"
    ]
  },
  {
    "id": "contract.button.icon.v1",
    "name": "Icon Button",
    "kind": "button",
    "fields": [
      "nodeId",
      "accessibilityLabelKey",
      "iconAssetId",
      "actionId"
    ]
  },
  {
    "id": "contract.input.text.v1",
    "name": "Text Input",
    "kind": "input",
    "fields": [
      "nodeId",
      "value",
      "labelKey",
      "placeholderKey",
      "errorKey",
      "bindingId",
      "changeActionId"
    ]
  },
  {
    "id": "contract.input.secret.v1",
    "name": "Secret Input",
    "kind": "input",
    "fields": [
      "nodeId",
      "labelKey",
      "bindingId"
    ],
    "constraints": [
      "never-plaintext-password"
    ]
  },
  {
    "id": "contract.input.select.v1",
    "name": "Selection Control",
    "kind": "input",
    "fields": [
      "nodeId",
      "bindingId",
      "state"
    ]
  },
  {
    "id": "contract.selection.toggle.v1",
    "name": "Toggle",
    "kind": "selection"
  },
  {
    "id": "contract.selection.checkbox.v1",
    "name": "Checkbox",
    "kind": "selection"
  },
  {
    "id": "contract.selection.radio.v1",
    "name": "Radio",
    "kind": "selection"
  },
  {
    "id": "contract.nav.bar.v1",
    "name": "Navigation Bar",
    "kind": "navigation"
  },
  {
    "id": "contract.nav.item.v1",
    "name": "Navigation Item",
    "kind": "navigation"
  },
  {
    "id": "contract.display.card.v1",
    "name": "Card",
    "kind": "display"
  },
  {
    "id": "contract.display.avatar.v1",
    "name": "Avatar",
    "kind": "display"
  },
  {
    "id": "contract.display.badge.v1",
    "name": "Badge",
    "kind": "display"
  },
  {
    "id": "contract.display.state.v1",
    "name": "State Surface",
    "kind": "display"
  },
  {
    "id": "contract.media.image.v1",
    "name": "Image",
    "kind": "media"
  },
  {
    "id": "contract.media.icon.v1",
    "name": "Icon",
    "kind": "media"
  },
  {
    "id": "contract.media.video.v1",
    "name": "Video",
    "kind": "media"
  },
  {
    "id": "contract.media.animation.v1",
    "name": "Animation",
    "kind": "media"
  },
  {
    "id": "contract.overlay.modal.v1",
    "name": "Modal",
    "kind": "overlay"
  },
  {
    "id": "contract.overlay.sheet.v1",
    "name": "Sheet",
    "kind": "overlay"
  },
  {
    "id": "contract.overlay.toast.v1",
    "name": "Toast",
    "kind": "overlay"
  },
  {
    "id": "contract.chat.bubble.v1",
    "name": "Message Bubble",
    "kind": "chat"
  },
  {
    "id": "contract.chat.composer.v1",
    "name": "Composer",
    "kind": "chat"
  },
  {
    "id": "contract.chat.inbox-row.v1",
    "name": "Inbox Row",
    "kind": "chat"
  },
  {
    "id": "contract.call.surface.v1",
    "name": "Call Surface",
    "kind": "call"
  },
  {
    "id": "contract.call.tile.v1",
    "name": "Call Participant Tile",
    "kind": "call"
  },
  {
    "id": "contract.call.control.v1",
    "name": "Call Control",
    "kind": "call"
  },
  {
    "id": "contract.live.header.v1",
    "name": "Live Header",
    "kind": "live"
  },
  {
    "id": "contract.live.seat.v1",
    "name": "Live Seat",
    "kind": "live"
  },
  {
    "id": "contract.live.gift-panel.v1",
    "name": "Gift Panel",
    "kind": "live"
  },
  {
    "id": "contract.seat.tile.v1",
    "name": "Seat Tile",
    "kind": "seat"
  },
  {
    "id": "contract.gift.thumbnail.v1",
    "name": "Gift Thumbnail",
    "kind": "gift"
  },
  {
    "id": "contract.gift.send.v1",
    "name": "Gift Send",
    "kind": "gift"
  },
  {
    "id": "contract.wallet.balance.v1",
    "name": "Wallet Balance",
    "kind": "wallet"
  },
  {
    "id": "contract.wallet.package.v1",
    "name": "Coin Package",
    "kind": "wallet"
  },
  {
    "id": "contract.layout.stack.v1",
    "name": "Stack Layout",
    "kind": "layout"
  },
  {
    "id": "contract.layout.grid.v1",
    "name": "Grid Layout",
    "kind": "layout"
  },
  {
    "id": "contract.layout.screen.v1",
    "name": "Screen Layout",
    "kind": "layout"
  }
] as const;
