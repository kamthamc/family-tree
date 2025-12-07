import { Hono } from 'hono';
import { db } from '../db';
import { people } from '../db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const app = new Hono();

// List all people
app.get('/', async (c) => {
    const result = await db.select().from(people).all();
    return c.json(result);
});

// Get one person
app.get('/:id', async (c) => {
    const id = c.req.param('id');
    const result = await db.select().from(people).where(eq(people.id, id)).get();
    if (!result) return c.notFound();
    return c.json(result);
});

// Create person
app.post('/', async (c) => {
    const body = await c.req.json();
    const id = uuidv4();
    const newPerson = {
        id,
        firstName: body.firstName,
        middleName: body.middleName,
        lastName: body.lastName,
        nickname: body.nickname,
        gender: body.gender,
        birthDate: body.birthDate,
        deathDate: body.deathDate,
        notes: body.notes,
        profileImage: body.profileImage,
        attributes: body.attributes,
    };
    await db.insert(people).values(newPerson).run();
    return c.json(newPerson, 201);
});

// Update person
app.put('/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    await db.update(people).set(body).where(eq(people.id, id)).run();
    return c.json({ id, ...body });
});

// Delete person
app.delete('/:id', async (c) => {
    const id = c.req.param('id');
    await db.delete(people).where(eq(people.id, id)).run();
    return c.json({ success: true });
});

export default app;
