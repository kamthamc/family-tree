import type { Context, Next } from 'hono';
import { getAuthService } from '../services/auth.service';

/**
 * Authentication middleware
 * Verifies JWT token and attaches user info to context
 */
export async function authenticate(c: Context, next: Next) {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.substring(7);

    try {
        const authService = getAuthService();
        const payload = authService.verifyAccessToken(token);

        // Attach user info to context
        c.set('userId', payload.userId);
        c.set('userEmail', payload.email);

        // Get user encryption key from header (sent by client)
        const userKeyHex = c.req.header('X-User-Key');
        if (userKeyHex) {
            c.set('userKey', Buffer.from(userKeyHex, 'hex'));
        }

        await next();
    } catch (error) {
        return c.json({ error: 'Invalid token' }, 401);
    }
}

/**
 * Optional authentication middleware
 * Allows requests without token but attaches user if present
 */
export async function optionalAuth(c: Context, next: Next) {
    const authHeader = c.req.header('Authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);

        try {
            const authService = getAuthService();
            const payload = authService.verifyAccessToken(token);

            c.set('userId', payload.userId);
            c.set('userEmail', payload.email);

            const userKeyHex = c.req.header('X-User-Key');
            if (userKeyHex) {
                c.set('userKey', Buffer.from(userKeyHex, 'hex'));
            }
        } catch (error) {
            // Ignore invalid token for optional auth
        }
    }

    await next();
}
