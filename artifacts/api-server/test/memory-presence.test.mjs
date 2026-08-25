import assert from "node:assert/strict";
import test from "node:test";
import {
  memoryClearUserDevicePresence,
  memoryFilterOnlineUserIds,
  memoryIsUserOnline,
  memorySetUserOnline,
} from "../src/lib/memoryPresence.ts";

test("memory presence online/offline", () => {
  const userId = `u_${Math.random().toString(36).slice(2)}`;
  assert.equal(memorySetUserOnline(userId, 90, "iphone"), true);
  assert.equal(memoryIsUserOnline(userId), true);
  assert.deepEqual(memoryFilterOnlineUserIds([userId, "missing"]), [userId]);
  memoryClearUserDevicePresence(userId, "iphone");
  assert.equal(memoryIsUserOnline(userId), false);
});
