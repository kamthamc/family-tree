import { Hono } from 'hono';
import { db } from '../db';
import { people, permissions } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth';
import { getEncryptionService } from '../services/encryption.service';

type Variables = {
    userId: string;
    userEmail: string;
    userKey: Buffer;
}

const app = new Hono<{ Variables: Variables }>();

app.use('*', authenticate);

// Helper to check permission
async function checkAccess(userId: string, familyTreeId: string) {
    const perm = await db.query.permissions.findFirst({
        where: and(
            eq(permissions.userId, userId),
            eq(permissions.familyTreeId, familyTreeId)
        )
    });
    // Owner permissions are also in the permissions table (inserted on creation)
    return !!perm;
}

// List all people for a family tree
app.get('/', async (c) => {
    const familyTreeId = c.req.query('familyTreeId');
    if (!familyTreeId) return c.json({ error: 'familyTreeId required' }, 400);

    const userId = c.get('userId');
    const hasAccess = await checkAccess(userId, familyTreeId);
    if (!hasAccess) return c.json({ error: 'Forbidden' }, 403);

    const userKey = c.get('userKey');
    if (!userKey) return c.json({ error: 'Encryption key required' }, 400);

    const encryptionService = getEncryptionService();
    const result = await db.select().from(people).where(eq(people.familyTreeId, familyTreeId));

    // Decrypt data
    const decrypted = result.map(p => encryptionService.decryptPerson(p, userKey));
    return c.json(decrypted);
});

// Get one person
app.get('/:id', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    const userKey = c.get('userKey');

    // We need to fetch familyTreeId first to check permission
    const person = await db.select().from(people).where(eq(people.id, id)).get();
    if (!person) return c.notFound();

    const hasAccess = await checkAccess(userId, person.familyTreeId);
    if (!hasAccess) return c.json({ error: 'Forbidden' }, 403);

    const encryptionService = getEncryptionService();
    return c.json(encryptionService.decryptPerson(person, userKey));
});

// Create person
app.post('/', async (c) => {
    const body = await c.req.json();
    const familyTreeId = body.familyTreeId; // Must be in body
    if (!familyTreeId) return c.json({ error: 'familyTreeId required' }, 400);

    const userId = c.get('userId');
    const hasAccess = await checkAccess(userId, familyTreeId);
    if (!hasAccess) return c.json({ error: 'Forbidden' }, 403);

    const userKey = c.get('userKey');
    const encryptionService = getEncryptionService();

    const id = uuidv4();

    // Encrypt sensitive fields
    const personData = {
        ...body,
        id, // Ensure ID is set
        familyTreeId
    };

    const encryptedData = encryptionService.encryptPerson(personData, userKey);

    await db.insert(people).values(encryptedData).run();

    // Return decrypted (or just echo back what we sent plus ID)
    return c.json({ ...body, id }, 201);
});

// Update person
app.put('/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const userId = c.get('userId');
    const userKey = c.get('userKey');

    const existing = await db.select().from(people).where(eq(people.id, id)).get();
    if (!existing) return c.notFound();

    const hasAccess = await checkAccess(userId, existing.familyTreeId);
    if (!hasAccess) return c.json({ error: 'Forbidden' }, 403);

    const encryptionService = getEncryptionService();

    // Encrypt fields
    // Merge with existing data so we don't lose fields not present in update? 
    // Usually PUT is full replace, but let's assume body contains fields to update.
    // encryptPerson expects a full object or plain fields. 
    // It returns an object with encrypted fields and undefined plain fields.
    // We should only update the fields present in body.

    // Better strategy: construct update object
    const updateData: any = { ...body };
    delete updateData.id;
    delete updateData.familyTreeId; // Don't allow moving trees easily

    // We need to encrypt the fields that are sensitive
    // Re-use encryptPerson but logic might be tricky if partial update.
    // For simplicity, let's just encrypt the incoming fields manually or helpers.
    // encryptPerson handles partials?
    // "firstName: undefined" in encryptPerson. 

    const encrypted = encryptionService.encryptPerson(updateData, userKey);

    // Remove undefined fields from encrypted object to avoid overwriting with null/default if using drizzle?
    // Drizzle ignores undefined? No, typically explicit values. 
    // Let's filter out undefined values.
    const cleanUpdate = Object.fromEntries(
        Object.entries(encrypted).filter(([_, v]) => v !== undefined)
    );

    await db.update(people).set(cleanUpdate).where(eq(people.id, id)).run();
    return c.json({ id, ...body });
});

// Delete person
app.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');

    const existing = await db.select().from(people).where(eq(people.id, id)).get();
    if (!existing) return c.notFound();

    const hasAccess = await checkAccess(userId, existing.familyTreeId);
    if (!hasAccess) return c.json({ error: 'Forbidden' }, 403);

    await db.delete(people).where(eq(people.id, id)).run();
    return c.json({ success: true });
});

export default app;
