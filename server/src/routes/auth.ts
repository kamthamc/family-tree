import { Hono } from 'hono';
import { getAuthService } from '../services/auth.service';
import { getEncryptionService } from '../services/encryption.service';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';

type Variables = {
    userId: string;
    userEmail: string;
    userKey: Buffer;
}

const app = new Hono<{ Variables: Variables }>();

// Register
app.post('/register', async (c) => {
    try {
        const data = await c.req.json();
        const authService = getAuthService();
        const result = await authService.register(data);
        return c.json(result);
    } catch (error: any) {
        return c.json({ error: error.message }, 400);
    }
});

// Login
app.post('/login', async (c) => {
    try {
        const data = await c.req.json();
        const authService = getAuthService();
        const result = await authService.login(data);
        return c.json(result);
    } catch (error: any) {
        return c.json({ error: error.message }, 401);
    }
});

// Get Current User
app.get('/me', authenticate, async (c) => {
    const userId = c.get('userId');
    try {
        const user = await db.query.users.findFirst({
            where: eq(users.id, userId),
            columns: {
                id: true,
                email: true,
                name: true,
                emailVerified: true,
                createdAt: true,
            }
        });

        if (!user) {
            return c.json({ error: 'User not found' }, 404);
        }

        return c.json(user);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Refresh Token (Simplified)
app.post('/refresh', async (c) => {
    // TODO: Implement full refresh logic
    return c.json({ message: "Not implemented yet" }, 501);
});

export default app;
