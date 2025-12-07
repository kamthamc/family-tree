import { Hono } from 'hono';
import { db } from '../db';
import { events } from '../db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const app = new Hono();

// List events for a person
app.get('/person/:personId', async (c) => {
    const personId = c.req.param('personId');
    const result = await db.select().from(events).where(eq(events.personId, personId)).all();
    return c.json(result);
});

// Create event
app.post('/', async (c) => {
    const body = await c.req.json();
    const id = uuidv4();
    const newEvent = {
        id,
        personId: body.personId,
        type: body.type,
        date: body.date,
        place: body.place,
        description: body.description,
    };
    await db.insert(events).values(newEvent).run();
    return c.json(newEvent, 201);
});

// Update event
app.put('/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    await db.update(events).set(body).where(eq(events.id, id)).run();
    return c.json({ id, ...body });
});

// Delete event
app.delete('/:id', async (c) => {
    const id = c.req.param('id');
    await db.delete(events).where(eq(events.id, id)).run();
    return c.json({ success: true });
});

export default app;
