import { Hono } from 'hono';
import { db } from '../db';
import { events, people } from '../db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth';
import { checkAccess } from '../utils/permissions';
import { getEncryptionService } from '../services/encryption.service';

type Variables = {
    userId: string;
    userEmail: string;
    userKey: Buffer;
}

const app = new Hono<{ Variables: Variables }>();

app.use('*', authenticate);

// List events for a person
app.get('/person/:personId', async (c) => {
    const personId = c.req.param('personId');
    const userId = c.get('userId');
    const userKey = c.get('userKey');

    // Check permission - find the person first to get `familyTreeId`
    // Wait, events rely on person, but we don't know the tree ID directly from event query unless we join person.
    // Or we fetch person first.
    const person = await db.select().from(people).where(eq(people.id, personId)).get();
    if (!person) return c.notFound();

    const hasAccess = await checkAccess(userId, person.familyTreeId);
    if (!hasAccess) return c.json({ error: 'Forbidden' }, 403);

    const result = await db.select().from(events).where(eq(events.personId, personId)).all();

    const encryptionService = getEncryptionService();
    // Helper to decrypt event
    const decryptEvent = (ev: any) => ({
        ...ev,
        date: ev.encryptedDate ? encryptionService.decrypt(ev.encryptedDate, userKey) : null,
        place: ev.encryptedPlace ? encryptionService.decrypt(ev.encryptedPlace, userKey) : null,
        description: ev.encryptedDescription ? encryptionService.decrypt(ev.encryptedDescription, userKey) : null,
        encryptedDate: undefined,
        encryptedPlace: undefined,
        encryptedDescription: undefined,
    });

    return c.json(result.map(decryptEvent));
});

// Create event
app.post('/', async (c) => {
    const body = await c.req.json();
    const { personId } = body;
    if (!personId) return c.json({ error: 'personId required' }, 400);

    const userId = c.get('userId');
    const userKey = c.get('userKey');

    // Check perms
    const person = await db.select().from(people).where(eq(people.id, personId)).get();
    if (!person) return c.json({ error: 'Person not found' }, 404);

    const hasAccess = await checkAccess(userId, person.familyTreeId);
    if (!hasAccess) return c.json({ error: 'Forbidden' }, 403);

    const encryptionService = getEncryptionService();
    const id = uuidv4();

    const newEvent = {
        id,
        personId,
        type: body.type,
        encryptedDate: body.date ? encryptionService.encrypt(body.date, userKey) : null,
        encryptedPlace: body.place ? encryptionService.encrypt(body.place, userKey) : null,
        encryptedDescription: body.description ? encryptionService.encrypt(body.description, userKey) : null,
    };

    await db.insert(events).values(newEvent).run();

    // Return with plaintext
    return c.json({
        id,
        personId,
        type: body.type,
        date: body.date,
        place: body.place,
        description: body.description
    }, 201);
});

// Update event
app.put('/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json(); // May contain updated fields
    const userId = c.get('userId');
    const userKey = c.get('userKey');

    const existing = await db.select().from(events).where(eq(events.id, id)).get();
    if (!existing) return c.notFound();

    // Check permission via person
    const person = await db.select().from(people).where(eq(people.id, existing.personId!)).get();
    if (!person) return c.notFound(); // Should not happen if foreign key integrity

    const hasAccess = await checkAccess(userId, person.familyTreeId);
    if (!hasAccess) return c.json({ error: 'Forbidden' }, 403);

    const encryptionService = getEncryptionService();

    const updateData: any = {};
    if (body.type !== undefined) updateData.type = body.type;
    if (body.date !== undefined) updateData.encryptedDate = encryptionService.encrypt(body.date, userKey);
    if (body.place !== undefined) updateData.encryptedPlace = encryptionService.encrypt(body.place, userKey);
    if (body.description !== undefined) updateData.encryptedDescription = encryptionService.encrypt(body.description, userKey);

    await db.update(events).set(updateData).where(eq(events.id, id)).run();
    return c.json({ id, ...body });
});

// Delete event
app.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');

    const existing = await db.select().from(events).where(eq(events.id, id)).get();
    if (!existing) return c.notFound();

    const person = await db.select().from(people).where(eq(people.id, existing.personId!)).get();
    if (!person) return c.notFound();

    const hasAccess = await checkAccess(userId, person.familyTreeId);
    if (!hasAccess) return c.json({ error: 'Forbidden' }, 403);

    await db.delete(events).where(eq(events.id, id)).run();
    return c.json({ success: true });
});

export default app;
