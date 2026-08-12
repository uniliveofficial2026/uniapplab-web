/**
 * Public chat-call context API.
 * App imports ChatCallProvider (thin host). Heavy impl loads async.
 */
export {
  ChatCallProviderHost as ChatCallProvider,
  useChatCallContext,
  ChatCallContext,
  IDLE_CHAT_CALL_VALUE,
} from './ChatCallProviderHost';
