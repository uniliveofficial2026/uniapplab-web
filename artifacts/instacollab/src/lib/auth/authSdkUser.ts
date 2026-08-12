/** Local auth user shape — avoids importing firebase/auth into the entry graph. */
export type AuthSdkUser = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  emailVerified?: boolean;
  getIdToken?: (forceRefresh?: boolean) => Promise<string>;
};
