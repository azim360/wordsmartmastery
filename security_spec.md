# Security Specification

## 1. Data Invariants
- Each user can only read, write, update, and delete their own user profile document at `/users/{userId}` where `userId == request.auth.uid`.
- Each user can only read and write their own drill progress documents at `/users/{userId}/drills/{drillId}` where `userId == request.auth.uid`.
- Unauthenticated users cannot read or write to `/users` or `/users/{userId}/drills`.
- No user can access or modify other users' drill progress or account details.
- User ID in document data must strictly match `request.auth.uid`.

## 2. Dirty Dozen Payloads (Security Attack Vectors)
1. **Unauthenticated Read**: Attempt to read `/users/user123` without auth token -> REJECTED.
2. **Cross-User Profile Read**: User A authenticated, attempting to read `/users/userB` -> REJECTED.
3. **Cross-User Profile Write**: User A attempting to write `/users/userB` -> REJECTED.
4. **Cross-User Drill Read**: User A attempting to list or get `/users/userB/drills/drill_1` -> REJECTED.
5. **Cross-User Drill Write**: User A attempting to write `/users/userB/drills/drill_1` -> REJECTED.
6. **Spoofed User ID in Data**: User A writing to `/users/userA/drills/drill_1` with payload `{ userId: 'userB' }` -> REJECTED.
7. **Invalid Drill Number**: User A writing drill progress with negative or non-integer `drillNum` -> REJECTED.
8. **Shadow Field Injection**: User A injecting arbitrary malicious fields (`isAdmin: true`, `role: 'super'`) into drill progress -> REJECTED.
9. **Junk Doc ID Poisoning**: Attempting to create a drill document with an oversized or malformed docId -> REJECTED.
10. **Unauthenticated Listing**: Attempting to collectionGroup query drills without owner isolation -> REJECTED.
11. **Negative Count Attack**: User setting `knownCount: -999` or non-integer values -> REJECTED.
12. **Status Map Oversize**: Injecting an oversized payload with thousands of keys into the status field -> REJECTED.
