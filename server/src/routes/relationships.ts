import { Hono } from 'hono';
import { db } from '../db';
import { relationships, people } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth';
import { checkAccess } from '../utils/permissions';

type Variables = {
    userId: string;
    userEmail: string;
    userKey: Buffer;
}

const app = new Hono<{ Variables: Variables }>();

app.use('*', authenticate);

// List all relationships for a family tree
app.get('/', async (c) => {
    const familyTreeId = c.req.query('familyTreeId');
    if (!familyTreeId) return c.json({ error: 'familyTreeId required' }, 400);

    const userId = c.get('userId');
    const hasAccess = await checkAccess(userId, familyTreeId);
    if (!hasAccess) return c.json({ error: 'Forbidden' }, 403);

    const result = await db.select().from(relationships).where(eq(relationships.familyTreeId, familyTreeId));
    return c.json(result);
});

// Create relationship
app.post('/', async (c) => {
    const body = await c.req.json();
    const familyTreeId = body.familyTreeId; // Must be provided
    if (!familyTreeId) return c.json({ error: 'familyTreeId required' }, 400);

    const userId = c.get('userId');
    const hasAccess = await checkAccess(userId, familyTreeId);
    if (!hasAccess) return c.json({ error: 'Forbidden' }, 403);

    const id = uuidv4();
    const newRel = {
        id,
        familyTreeId,
        fromPersonId: body.fromPersonId,
        toPersonId: body.toPersonId,
        type: body.type,
    };

    await db.insert(relationships).values(newRel).run();
    return c.json(newRel, 201);
});

// Delete relationship
app.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');

    const existing = await db.select().from(relationships).where(eq(relationships.id, id)).get();
    if (!existing) return c.notFound();

    const hasAccess = await checkAccess(userId, existing.familyTreeId);
    if (!hasAccess) return c.json({ error: 'Forbidden' }, 403);

    await db.delete(relationships).where(eq(relationships.id, id)).run();
    return c.json({ success: true });
});

// Update relationship
app.put('/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const userId = c.get('userId');

    const existing = await db.select().from(relationships).where(eq(relationships.id, id)).get();
    if (!existing) return c.notFound();

    const hasAccess = await checkAccess(userId, existing.familyTreeId);
    if (!hasAccess) return c.json({ error: 'Forbidden' }, 403);

    // Only type is updateable?
    await db.update(relationships).set({ type: body.type }).where(eq(relationships.id, id)).run();
    return c.json({ success: true });
});


export default app;
