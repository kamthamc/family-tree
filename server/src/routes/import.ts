import { Hono } from 'hono';
import { db } from '../db';
import { people, relationships, events } from '../db/schema';
import { eq } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import { getEncryptionService } from '../services/encryption.service';

type Variables = {
    userId: string;
    userEmail: string;
    userKey: Buffer;
}

const app = new Hono<{ Variables: Variables }>();

app.use('*', authenticate);

app.post('/', async (c) => {
    // 1. Get User Key for encryption
    // The auth middleware sets this if X-User-Key is present and valid
    const userKey = c.get('userKey') as Buffer;
    if (!userKey) {
        return c.json({ error: 'Encryption key required' }, 400);
    }

    const { people: peopleList, relationships: relationshipsList, familyTreeId } = await c.req.json();

    if (!familyTreeId) {
        return c.json({ error: 'Family Tree ID is required' }, 400);
    }

    const encryptionService = getEncryptionService();

    try {
        await db.transaction(async (tx) => {
            if (peopleList && peopleList.length > 0) {
                // Upsert people
                for (const person of peopleList) {
                    // 1. Encrypt sensitive fields
                    // The incoming person object has plaintext fields (firstName, etc.)
                    // We need to convert them to encrypted fields
                    const encryptedPerson = encryptionService.encryptPerson(person, userKey);

                    // 2. Inject familyTreeId
                    const personToInsert = {
                        ...encryptedPerson,
                        familyTreeId: familyTreeId, // Enforce the target tree
                        // Ensure ID is present
                        id: person.id,
                        // Ensure other required fields if any (createdAt default handles itself)
                    };

                    const existing = await tx.select().from(people).where(eq(people.id, person.id)).get();
                    if (existing) {
                        // For updates, we need to be careful not to overwrite familyId if we don't want to move them?
                        // But import usually implies overwrite.
                        await tx.update(people).set(personToInsert).where(eq(people.id, person.id)).run();
                    } else {
                        await tx.insert(people).values(personToInsert).run();
                    }
                }
            }

            if (relationshipsList && relationshipsList.length > 0) {
                // Upsert relationships
                for (const rel of relationshipsList) {
                    const relToInsert = {
                        ...rel,
                        familyTreeId: familyTreeId
                    };

                    const existing = await tx.select().from(relationships).where(eq(relationships.id, rel.id)).get();
                    if (existing) {
                        await tx.update(relationships).set(relToInsert).where(eq(relationships.id, rel.id)).run();
                    } else {
                        await tx.insert(relationships).values(relToInsert).run();
                    }
                }
            }
        });

        return c.json({ success: true, message: 'Import successful' });
    } catch (error: any) {
        console.error('Import error:', error);
        return c.json({ success: false, error: 'Import failed: ' + error.message }, 500);
    }
});

export default app;
