/** Firebase Storage helpers for chat media — loaded only via dynamic import(). */
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { getFirebaseStorage } from './app';
import { isFirebaseConfigured } from './config';

export async function uploadChatMediaToFirebase(input: {
  userId: string;
  messageId: string;
  blob: Blob;
  fileName: string;
  prefix?: string;
}): Promise<string | null> {
  if (!isFirebaseConfigured()) return null;
  const storage = getFirebaseStorage();
  if (!storage) return null;

  const path = `${input.prefix ?? 'chat-media'}/${input.userId}/${input.messageId}/${Date.now()}_${input.fileName}`;
  try {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, input.blob, {
      contentType: input.blob.type || 'application/octet-stream',
    });
    return await getDownloadURL(storageRef);
  } catch (err) {
    console.warn('[chat-media] firebase upload failed:', err);
    return null;
  }
}
