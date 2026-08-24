import type { CommerceOrder, CommerceProduct } from '../../smule-rooms/utils/liveRoomTypes';

/** Commerce orders lane — isolated from gift settle / gift wallet. */
const STORAGE_KEY = 'unilive.commerce.orders.v1';

function readAll(): CommerceOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CommerceOrder[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(orders: CommerceOrder[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders.slice(0, 400)));
  } catch {
    /* quota */
  }
}

export function upsertCommerceOrder(order: CommerceOrder): CommerceOrder {
  const next = readAll().filter((row) => row.id !== order.id);
  next.unshift(order);
  writeAll(next);
  return order;
}

export function listCommerceOrders(filter?: { buyerUserId?: string; hostUserId?: string }): CommerceOrder[] {
  const all = readAll();
  if (!filter) return all;
  return all.filter((order) => {
    if (filter.buyerUserId && order.buyerUserId === filter.buyerUserId) return true;
    if (filter.hostUserId && (order as CommerceOrder & { hostUserId?: string }).hostUserId === filter.hostUserId) {
      return true;
    }
    return false;
  });
}

export function markCommerceOrderShipped(orderId: string, trackingNumber?: string): CommerceOrder | null {
  const all = readAll();
  const index = all.findIndex((order) => order.id === orderId);
  if (index < 0) return null;
  const updated: CommerceOrder = {
    ...all[index],
    status: 'shipped',
    shippedAt: Date.now(),
    trackingNumber: trackingNumber || all[index].trackingNumber || `UL${Date.now().toString().slice(-10)}`,
    carrier: all[index].carrier || 'UniLive Express',
    estimatedDelivery: all[index].estimatedDelivery || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toDateString(),
  };
  all[index] = updated;
  writeAll(all);
  return updated;
}

let pinnedProduct: CommerceProduct | null = null;

export function setPinnedCommerceProduct(product: CommerceProduct | null): void {
  pinnedProduct = product;
}

export function getPinnedCommerceProduct(): CommerceProduct | null {
  return pinnedProduct;
}
