import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { getEncryptionService } from './encryption.service';

export interface RegisterData {
    email: string;
    password: string;
    name?: string;
}

export interface LoginData {
    email: string;
    password: string;
}

export interface TokenPayload {
    userId: string;
    email: string;
}

export class AuthService {
    private jwtSecret: string;
    private jwtExpiry: string;
    private refreshSecret: string;
    private refreshExpiry: string;

    constructor() {
        this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
        this.jwtExpiry = process.env.JWT_EXPIRY || '15m';
        this.refreshSecret = process.env.REFRESH_TOKEN_SECRET || 'your-refresh-secret';
        this.refreshExpiry = process.env.REFRESH_TOKEN_EXPIRY || '7d';
    }

    /**
     * Register a new user
     */
    async register(data: RegisterData) {
        const { email, password, name } = data;

        // Check if user already exists
        const existing = await db.query.users.findFirst({
            where: eq(users.email, email)
        });

        if (existing) {
            throw new Error('User already exists');
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 12);

        // Generate encryption key materials
        const encryptionService = getEncryptionService();
        const salt = encryptionService.generateSalt();
        const userKey = encryptionService.deriveUserKey(password, salt);
        const encryptedUserKey = encryptionService.encryptUserKey(userKey);

        // Create user
        const userId = crypto.randomUUID();
        await db.insert(users).values({
            id: userId,
            email,
            passwordHash,
            name: name || null,
            emailVerified: false,
            encryptionSalt: salt.toString('hex'),
            encryptedUserKey,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });

        // Generate tokens
        const accessToken = this.generateAccessToken({ userId, email });
        const refreshToken = this.generateRefreshToken({ userId, email });

        return {
            user: {
                id: userId,
                email,
                name,
                emailVerified: false,
            },
            accessToken,
            refreshToken,
            userKey: userKey.toString('hex'), // Send to client for session
        };
    }

    /**
     * Login user
     */
    async login(data: LoginData) {
        const { email, password } = data;

        // Find user
        const user = await db.query.users.findFirst({
            where: eq(users.email, email)
        });

        if (!user) {
            throw new Error('Invalid credentials');
        }

        // Verify password
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
            throw new Error('Invalid credentials');
        }

        // Derive user encryption key
        const encryptionService = getEncryptionService();
        const salt = Buffer.from(user.encryptionSalt, 'hex');
        const userKey = encryptionService.deriveUserKey(password, salt);

        // Verify user key by decrypting stored encrypted key
        try {
            encryptionService.decryptUserKey(user.encryptedUserKey);
        } catch (error) {
            throw new Error('Encryption key verification failed');
        }

        // Generate tokens
        const accessToken = this.generateAccessToken({ userId: user.id, email: user.email });
        const refreshToken = this.generateRefreshToken({ userId: user.id, email: user.email });

        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                emailVerified: user.emailVerified,
            },
            accessToken,
            refreshToken,
            userKey: userKey.toString('hex'), // Send to client for session
        };
    }

    /**
     * Verify access token
     */
    verifyAccessToken(token: string): TokenPayload {
        try {
            return jwt.verify(token, this.jwtSecret) as TokenPayload;
        } catch (error) {
            throw new Error('Invalid token');
        }
    }

    /**
     * Verify refresh token
     */
    verifyRefreshToken(token: string): TokenPayload {
        try {
            return jwt.verify(token, this.refreshSecret) as TokenPayload;
        } catch (error) {
            throw new Error('Invalid refresh token');
        }
    }

    /**
     * Generate access token
     */
    private generateAccessToken(payload: TokenPayload): string {
        return jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiry });
    }

    /**
     * Generate refresh token
     */
    private generateRefreshToken(payload: TokenPayload): string {
        return jwt.sign(payload, this.refreshSecret, { expiresIn: this.refreshExpiry });
    }

    /**
     * Refresh access token
     */
    async refreshAccessToken(refreshToken: string) {
        const payload = this.verifyRefreshToken(refreshToken);
        const accessToken = this.generateAccessToken(payload);
        return { accessToken };
    }
}

// Singleton instance
let authService: AuthService | null = null;

export function getAuthService(): AuthService {
    if (!authService) {
        authService = new AuthService();
    }
    return authService;
}
