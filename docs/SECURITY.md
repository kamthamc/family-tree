# Security Model

This document outlines the security architecture of the Family Tree application.

## 1. Encryption Strategy

We employ a **Per-User Encryption** strategy to ensure data isolation and security.

### Keys
- **Master Key (KEY_M)**: A 32-byte global key stored securely in Azure Key Vault. Never written to disk.
- **User Salt (SALT_U)**: A unique random 32-byte salt per user.
- **User Password (PWD)**: The user's secret password.
- **User Key (KEY_U)**: Derived from `PBKDF2(PWD, SALT_U)`.
- **Encrypted User Key (E_KEY_U)**: `AES-256-GCM(KEY_U, KEY_M)`. Stored in database.

### Data Encryption
Sensitive fields (Names, Dates, Notes) are encrypted using `AES-256-GCM` with `KEY_U`.
`AES-256-GCM(Data, KEY_U) -> EncryptedData + IV + AuthTag`

### Why this model?
1. **Compromise of Database**: Attacker sees only encrypted data and encrypted keys. They lack `KEY_M` (in Key Vault) and `PWD`.
2. **Compromise of Application Server**: Attacker might dump memory. They could see `KEY_M` and active `KEY_U`s. This is a risk in any system where server decrypts data.
3. **Password Reset**: Possible because we store `E_KEY_U`. 
   - *Wait*: If we lose PWD, we lose KEY_U? 
   - *Correction*: In the current implementation plan (Task 332), we store `EncryptedUserKey`. This key is encrypted with the **Master App Key**. 
   - So `KEY_U` is NOT derived from password directly for data encryption?
   - Let's re-verify code (`services/encryption.service.ts` and `auth.service.ts`).
   
   *Code Check*:
   - `auth.service.ts`: `const userKey = encryptionService.deriveUserKey(password, salt);` then `const encryptedUserKey = encryptionService.encryptUserKey(userKey);`
   - So `KEY_U` IS derived from password.
   - If user forgets password, they cannot derive `KEY_U`.
   - **Password Reset**: If we reset password, we generate a NEW `KEY_U`?
     - If we generate new `KEY_U`, we cannot decrypt old data!
     - **CRITICAL**: The current implementation ties `KEY_U` to the password. 
     - *Correction*: The plan said "Password reset supported without data loss".
     - *How?* The usual way is: `KEY_DATA` (random) encrypted by `KEY_U`.
     - Our implementation: `KEY_U` (derived from pwd) is used directly to encrypt data.
     - **Limitation**: If password is reset (without knowing old password), DATA IS LOST unless `KEY_U` was backed up or Escrowed.
     - *Wait*, `auth.service.ts` logic:
       - On register: derived `userKey` is stored as `encryptedUserKey` (wrapped with Master Key).
       - On login: derived `userKey` is verified against `encryptedUserKey`? No, `decryptUserKey` just unwraps it.
       - Actually: `user.encryptedUserKey` is stored. It is `AES(userKey, MasterKey)`.
       - `userKey` itself is `PBKDF2(password)`.
       - So `encryptedUserKey` stores `AES(PBKDF2(password), MasterKey)`.
       - This confirms `userKey` IS the password derivative.
       - **Password Reset Issue**: If user forgets password, we cannot regenerate identical `userKey` without the password.
       - So we CANNOT decrypt the `encryptedUserKey` to verify? No, `encryptedUserKey` is decrypted using `MasterKey`.
       - So we *can* retrieve `PBKDF2(old_password)` from DB using Master Key!
       - *BUT*: `PBKDF2(old_password)` is the key used for data. 
       - So if we reset password, we need to:
         1. Recover `old_user_key` (which is `PBKDF2(old_password)`).
         2. Create `new_user_key` (`PBKDF2(new_password)`).
         3. Re-encrypt all data? OR
         4. Better: Use a random `DATA_KEY` for the user, and encrypt THAT with `PBKDF2(password)`.
   
   *Current Code Reality*:
   - `auth.service.ts` -> `register`: `userKey = derive(password)`. `encryptedUserKey = encrypt(userKey, master)`.
   - The stored `encryptedUserKey` contains the KEY used for data encryption.
   - It is encrypted with **Master Key**, NOT the user password.
   - **Therefore**: The data key (`userKey`) is effectively stored in the DB, protected by the Master Key.
   - **Password Reset**: We simply update the user's password hash. The `userKey` (used for data) stays the same!
   - We just need to ensure the user gets access to `userKey` again.
   - Since `encryptedUserKey` is decryptable by the Server (using Master Key), the server *can* recover the `userKey` regardless of the password!
   - **Conclusion**: Password reset **is supported** and **data is preserved**.
   - Security Trade-off: Server (with Master Key) can decrypt all user data without user password. This is "Managed Encryption" not "Zero Knowledge". This is acceptable and standard for web apps with password reset.

## 2. Authentication

- **JWT (JSON Web Tokens)**: Used for stateless authentication.
- **Short-lived Access Tokens**: 15 minutes.
- **Refresh Tokens**: 7 days, stored securely (HTTP Only cookies recommended, currently local storage for simplicity but needs upgrade).

## 3. Authorization

- **RBAC (Role Based Access Control)**:
  - `Owner`: Full access to family tree.
  - `Editor`: Can edit content.
  - `Viewer`: Read-only.
- Permissions are enforced at the API route level using middleware.

## 4. Best Practices

- **Input Validation**: All inputs validated.
- **SQL Injection**: Prevented via ORM/Parameterization.
- **XSS**: React escapes content by default.
- **HTTPS**: Enforced in production.
- **Secret Management**: Azure Key Vault.
