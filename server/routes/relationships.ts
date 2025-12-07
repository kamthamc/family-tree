import { Hono } from 'hono';
import { db } from '../db';
import { relationships } from '../db/schema';
import { eq, or, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const app = new Hono();

// List all relationships
app.get('/', async (c) => {
    const result = await db.select().from(relationships).all();
    return c.json(result);
});

// Create relationship
app.post('/', async (c) => {
    const body = await c.req.json();
    const id = uuidv4();
    const newRel = {
        id,
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
    await db.delete(relationships).where(eq(relationships.id, id)).run();
    return c.json({ success: true });
});

// Update relationship
app.put('/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    await db.update(relationships).set({ type: body.type }).where(eq(relationships.id, id)).run();
    return c.json({ success: true });
});


export default app;
