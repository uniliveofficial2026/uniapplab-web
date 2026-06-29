# Firestore Security Specification

## Data Invariants
1. A user profile must have a unique `username`.
2. A post must be associated with a valid `userId`.
3. A message must belong to a thread where the sender is a participant.
4. Notifications are only readable by the target user.

## The Dirty Dozen (Payloads to Block)
1. **Identity Spoofing**: Attempting to create a user profile with a different UID than the authenticated user.
2. **Username Theft**: Attempting to change someone else's username.
3. **Ghost Verification**: A regular user attempting to set `isVerified: true` on their profile.
4. **Oversized Bio**: Attempting to save a bio string larger than 500 characters.
5. **Like Inflation**: Attempting to directly update the `likesCount` on a post document without an atomic transaction or proper permissions.
6. **Malicious Message Injection**: Attempting to send a message into a chat you aren't part of.
7. **Notification Snooping**: Attempting to read another user's notifications.
8. **Shadow Field Injection**: Adding unapproved fields like `isAdmin: true` to a profile.
9. **Timestamp Manipulation**: Providing a client-side `createdAt` that doesn't match the server time.
10. **Orphaned Post**: Creating a post with a `userId` that doesn't exist.
11. **Mass Deletion**: Attempting to delete a collection without owning all documents.
12. **Metadata Tampering**: Attempting to change the `storageTier` without a payment/admin process.

## Test Strategy
Verified via `firestore.rules`.
