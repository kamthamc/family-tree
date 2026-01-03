import crypto from 'crypto';

/**
 * Encryption Service
 * Implements per-user encryption with master key protection
 * 
 * Security model:
 * - Each user has unique encryption key derived from password
 * - User keys are encrypted with master app key before storage
 * - Attacker needs both master key AND user passwords to decrypt data
 */
export class EncryptionService {
    private masterKey: Buffer;

    constructor(masterKeyHex: string) {
        if (!masterKeyHex || masterKeyHex.length !== 64) {
            throw new Error('Master key must be 32 bytes (64 hex characters)');
        }
        this.masterKey = Buffer.from(masterKeyHex, 'hex');
    }

    /**
     * Derive user encryption key from password
     * Uses PBKDF2 with 100,000 iterations for strong key derivation
     */
    deriveUserKey(password: string, salt: Buffer): Buffer {
        return crypto.pbkdf2Sync(
            password,
            salt,
            100000, // iterations
            32, // key length (256 bits)
            'sha256'
        );
    }

    /**
     * Generate random salt for key derivation
     */
    generateSalt(): Buffer {
        return crypto.randomBytes(32);
    }

    /**
     * Encrypt user's encryption key with master key
     * This allows password resets without re-encrypting all data
     */
    encryptUserKey(userKey: Buffer): string {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);

        const encrypted = Buffer.concat([
            cipher.update(userKey),
            cipher.final()
        ]);

        const authTag = cipher.getAuthTag();

        return JSON.stringify({
            iv: iv.toString('hex'),
            data: encrypted.toString('hex'),
            authTag: authTag.toString('hex')
        });
    }

    /**
     * Decrypt user's encryption key with master key
     */
    decryptUserKey(encryptedKey: string): Buffer {
        try {
            const { iv, data, authTag } = JSON.parse(encryptedKey);

            const decipher = crypto.createDecipheriv(
                'aes-256-gcm',
                this.masterKey,
                Buffer.from(iv, 'hex')
            );

            decipher.setAuthTag(Buffer.from(authTag, 'hex'));

            return Buffer.concat([
                decipher.update(Buffer.from(data, 'hex')),
                decipher.final()
            ]);
        } catch (error) {
            throw new Error('Failed to decrypt user key');
        }
    }

    /**
     * Encrypt data with user's key
     * Uses AES-256-GCM for authenticated encryption
     */
    encrypt(data: string, userKey: Buffer): string {
        if (!data) return '';

        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', userKey, iv);

        const encrypted = Buffer.concat([
            cipher.update(data, 'utf8'),
            cipher.final()
        ]);

        const authTag = cipher.getAuthTag();

        return JSON.stringify({
            iv: iv.toString('hex'),
            data: encrypted.toString('hex'),
            authTag: authTag.toString('hex')
        });
    }

    /**
     * Decrypt data with user's key
     */
    decrypt(encrypted: string, userKey: Buffer): string {
        if (!encrypted) return '';

        try {
            const { iv, data, authTag } = JSON.parse(encrypted);

            const decipher = crypto.createDecipheriv(
                'aes-256-gcm',
                userKey,
                Buffer.from(iv, 'hex')
            );

            decipher.setAuthTag(Buffer.from(authTag, 'hex'));

            return decipher.update(Buffer.from(data, 'hex'), undefined, 'utf8') +
                decipher.final('utf8');
        } catch (error) {
            throw new Error('Failed to decrypt data');
        }
    }

    /**
     * Encrypt person object fields
     */
    encryptPerson(person: any, userKey: Buffer): any {
        return {
            ...person,
            encryptedFirstName: person.firstName ? this.encrypt(person.firstName, userKey) : null,
            encryptedMiddleName: person.middleName ? this.encrypt(person.middleName, userKey) : null,
            encryptedLastName: person.lastName ? this.encrypt(person.lastName, userKey) : null,
            encryptedNickname: person.nickname ? this.encrypt(person.nickname, userKey) : null,
            encryptedBirthDate: person.birthDate ? this.encrypt(person.birthDate, userKey) : null,
            encryptedDeathDate: person.deathDate ? this.encrypt(person.deathDate, userKey) : null,
            encryptedNotes: person.notes ? this.encrypt(person.notes, userKey) : null,
            encryptedAddress: person.address ? this.encrypt(person.address, userKey) : null,
            encryptedPhone: person.phone ? this.encrypt(person.phone, userKey) : null,
            // Remove plaintext fields
            firstName: undefined,
            middleName: undefined,
            lastName: undefined,
            nickname: undefined,
            birthDate: undefined,
            deathDate: undefined,
            notes: undefined,
            address: undefined,
            phone: undefined,
        };
    }

    /**
     * Decrypt person object fields
     */
    decryptPerson(person: any, userKey: Buffer): any {
        return {
            ...person,
            firstName: person.encryptedFirstName ? this.decrypt(person.encryptedFirstName, userKey) : null,
            middleName: person.encryptedMiddleName ? this.decrypt(person.encryptedMiddleName, userKey) : null,
            lastName: person.encryptedLastName ? this.decrypt(person.encryptedLastName, userKey) : null,
            nickname: person.encryptedNickname ? this.decrypt(person.encryptedNickname, userKey) : null,
            birthDate: person.encryptedBirthDate ? this.decrypt(person.encryptedBirthDate, userKey) : null,
            deathDate: person.encryptedDeathDate ? this.decrypt(person.encryptedDeathDate, userKey) : null,
            notes: person.encryptedNotes ? this.decrypt(person.encryptedNotes, userKey) : null,
            address: person.encryptedAddress ? this.decrypt(person.encryptedAddress, userKey) : null,
            phone: person.encryptedPhone ? this.decrypt(person.encryptedPhone, userKey) : null,
            // Remove encrypted fields from response
            encryptedFirstName: undefined,
            encryptedMiddleName: undefined,
            encryptedLastName: undefined,
            encryptedNickname: undefined,
            encryptedBirthDate: undefined,
            encryptedDeathDate: undefined,
            encryptedNotes: undefined,
            encryptedAddress: undefined,
            encryptedPhone: undefined,
        };
    }
}

// Singleton instance
let encryptionService: EncryptionService | null = null;

export function getEncryptionService(): EncryptionService {
    if (!encryptionService) {
        const masterKey = process.env.MASTER_ENCRYPTION_KEY;
        if (!masterKey) {
            throw new Error('MASTER_ENCRYPTION_KEY environment variable is required');
        }
        encryptionService = new EncryptionService(masterKey);
    }
    return encryptionService;
}
