/**
 * NotificationService — wraps existing cloud notification sync.
 */
import {
  syncCloudNotifications,
  startCloudNotificationRealtime,
  stopCloudNotificationRealtime,
  markCloudNotificationRead,
  markAllCloudNotificationsRead,
  queueCloudNotificationDelivery,
} from '../lib/cloudNotificationSync';
import type { ServiceResult } from '../types/platform';

export interface NotificationService {
  sync(): Promise<ServiceResult<void>>;
  startRealtime(userId: string): void;
  stopRealtime(): void;
  markRead(notificationId: string): Promise<ServiceResult<void>>;
  markAllRead(): Promise<ServiceResult<void>>;
  queue: typeof queueCloudNotificationDelivery;
}

class NotificationServiceImpl implements NotificationService {
  async sync(): Promise<ServiceResult<void>> {
    try {
      await syncCloudNotifications();
      return { ok: true, data: undefined };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  startRealtime(userId: string): void {
    startCloudNotificationRealtime(userId);
  }

  stopRealtime(): void {
    stopCloudNotificationRealtime();
  }

  async markRead(notificationId: string): Promise<ServiceResult<void>> {
    try {
      await markCloudNotificationRead(notificationId);
      return { ok: true, data: undefined };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async markAllRead(): Promise<ServiceResult<void>> {
    try {
      await markAllCloudNotificationsRead();
      return { ok: true, data: undefined };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  queue = queueCloudNotificationDelivery;
}

export const notificationService: NotificationService = new NotificationServiceImpl();
