/**
 * Master switch for the DeepAR SDK (filters, beauty plugin, asset preloading).
 * Live rooms and video calls use Tencent WebAR / TRTC beauty only while this is false.
 * Set to `true` only when re-enabling DeepAR — also requires `VITE_DEEPAR_LICENSE_KEY`.
 */
export const DEEPAR_ENABLED = false;
