/**
 * Live sync never reloads the page — updates apply on the user's next natural visit.
 * (No visible load flash while they are using the app.)
 */
export function queueInvisibleReload(_reason?: string): void {
  // intentional no-op
}

export function cancelInvisibleReload(): void {
  // intentional no-op
}
