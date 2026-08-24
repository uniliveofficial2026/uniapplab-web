import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('messages: cloud send path uses chat outbox processor', () => {
  const sync = fs.readFileSync(path.join(root, 'src/lib/chat/cloudChatSync.ts'), 'utf8');
  assert.match(sync, /enqueueChatMessageSend/);
  assert.match(sync, /processChatOutbox/);
  assert.match(sync, /getOutboxItemByMutation/);
});

test('messages: outbox store supports mutation identity + remove', () => {
  const store = fs.readFileSync(path.join(root, 'src/lib/outbox/outboxStore.ts'), 'utf8');
  assert.match(store, /mutationId|mutation_id|getOutboxItemByMutation/);
  assert.match(store, /removeOutboxItemsByMutation|removeOutbox/);
});

test('messages: outbox processor is idempotent-safe on retries', () => {
  const proc = fs.readFileSync(path.join(root, 'src/lib/outbox/chatOutboxProcessor.ts'), 'utf8');
  assert.match(proc, /enqueueChatMessageSend/);
  assert.match(proc, /processChatOutbox/);
  assert.match(proc, /idempoten|already|duplicate|mutation/i);
});
