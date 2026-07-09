declare module "@workspace/upstash" {
  export const KEYS: {
    handoffQueue: string;
    uxSignals: string;
    feedPosts: string;
    handoffState: string;
    presencePrefix: string;
    typingSetPrefix: string;
    streamViewersPrefix: string;
  };

  export function isUpstashConfigured(): boolean;
  export function getRedis(): import("@upstash/redis").Redis | null;
  export function pingRedis(): Promise<{ ok: boolean; pong?: string; reason?: string }>;
  export function pushHandoffTask(task: Record<string, unknown>): Promise<string | false>;
  export function popHandoffTasks(limit?: number): Promise<Record<string, unknown>[]>;
  export function trimHandoffQueue(keep?: number): Promise<void>;
  export function pushUxSignals(signals: unknown[]): Promise<boolean>;
  export function popUxSignals(limit?: number): Promise<unknown[]>;
  export function getCachedFeedPosts(): Promise<unknown>;
  export function setCachedFeedPosts(
    posts: unknown,
    ttlSeconds?: number,
  ): Promise<boolean>;
  export function rewriteHandoffQueue(
    tasks: Record<string, unknown>[],
  ): Promise<boolean>;
  export function setUserOnline(userId: string, ttlSeconds?: number): Promise<boolean>;
  export function isUserOnline(userId: string): Promise<boolean>;
  export function filterOnlineUserIds(userIds: string[]): Promise<string[]>;
  export function setTypingIndicator(
    threadId: string,
    userId: string,
    ttlSeconds?: number,
  ): Promise<boolean>;
  export function getTypingUserIds(threadId: string): Promise<string[]>;
  export function getStreamViewers(streamId: string): Promise<number>;
  export function incrStreamViewers(streamId: string): Promise<number>;
  export function decrStreamViewers(streamId: string): Promise<number>;
}
