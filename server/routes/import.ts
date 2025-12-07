import { Hono } from 'hono';
import { db } from '../db';
import { people, relationships, events } from '../db/schema';
import { eq } from 'drizzle-orm';

const app = new Hono();

app.post('/', async (c) => {
    const { people: peopleList, relationships: relationshipsList } = await c.req.json();

    try {
        db.transaction(async (tx) => {
            if (peopleList && peopleList.length > 0) {
                // Upsert people
                for (const person of peopleList) {
                    const existing = await tx.select().from(people).where(eq(people.id, person.id)).get();
                    if (existing) {
                        await tx.update(people).set(person).where(eq(people.id, person.id)).run();
                    } else {
                        await tx.insert(people).values(person).run();
                    }
                }
            }

            if (relationshipsList && relationshipsList.length > 0) {
                // Upsert relationships
                for (const rel of relationshipsList) {
                    const existing = await tx.select().from(relationships).where(eq(relationships.id, rel.id)).get();
                    if (existing) {
                        await tx.update(relationships).set(rel).where(eq(relationships.id, rel.id)).run();
                    } else {
                        await tx.insert(relationships).values(rel).run();
                    }
                }
            }
        });

        return c.json({ success: true, message: 'Import successful' });
    } catch (error) {
        console.error('Import error:', error);
        return c.json({ success: false, error: 'Import failed' }, 500);
    }
});

export default app;
