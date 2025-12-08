import { Hono } from 'hono';
import { authenticate } from '../middleware/auth';
import { db } from '../db';
import { familyTrees, permissions, people, relationships, events } from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import crypto from 'crypto';

type Variables = {
    userId: string;
    userEmail: string;
    userKey: Buffer;
}

const app = new Hono<{ Variables: Variables }>();

app.use('*', authenticate);

// List user's family trees
app.get('/', async (c) => {
    const userId = c.get('userId') as string;

    try {
        // Get trees where user is owner or has permission
        // For now, let's just fetch ones they own + ones in permissions table
        // Drizzle query for permissions join
        const userPermissions = await db.select().from(permissions).where(eq(permissions.userId, userId));
        const treeIds = userPermissions.map(p => p.familyTreeId);

        const ownedTrees = await db.select().from(familyTrees).where(eq(familyTrees.ownerId, userId));

        // Combine
        // We could optimize this query
        const sharedTrees = treeIds.length > 0
            ? await db.select().from(familyTrees).where(inArray(familyTrees.id, treeIds))
            : [];

        return c.json({
            owned: ownedTrees,
            shared: sharedTrees
        });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Create new family tree
app.post('/', async (c) => {
    const userId = c.get('userId') as string;
    const { name, description } = await c.req.json();

    if (!name) {
        return c.json({ error: 'Name is required' }, 400);
    }

    try {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();

        // Transaction
        await db.transaction(async (tx) => {
            await tx.insert(familyTrees).values({
                id,
                ownerId: userId,
                name,
                description,
                createdAt: now,
                updatedAt: now,
            });

            // Add owner permission (optional, since ownerId is on tree)
            // But useful for uniform permission checking
            await tx.insert(permissions).values({
                id: crypto.randomUUID(),
                familyTreeId: id,
                userId: userId,
                role: 'owner',
                createdAt: now
            });
        });

        return c.json({ id, name, description }, 201);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Duplicate family tree
app.post('/:id/duplicate', async (c) => {
    const userId = c.get('userId') as string;
    const sourceTreeId = c.req.param('id');

    try {
        // 1. Verify access to source tree
        // Owner or Editor can duplicate? Let's say yes.
        // Or check ownership of source?
        const sourceTree = await db.select().from(familyTrees).where(eq(familyTrees.id, sourceTreeId)).get();
        if (!sourceTree) return c.json({ error: 'Tree not found' }, 404);

        // Basic check: must be owner to duplicate? Or just have read access?
        // If they have read access, they can copy the data.
        // Let's allow if they can read it.
        // For simplicity, I'll allow duplication if they have permission entry or are owner.
        const perm = await db.select().from(permissions).where(and(eq(permissions.familyTreeId, sourceTreeId), eq(permissions.userId, userId))).get();
        if (sourceTree.ownerId !== userId && !perm) {
            return c.json({ error: 'Forbidden' }, 403);
        }

        const newTreeId = crypto.randomUUID();
        const now = new Date().toISOString();
        const newName = `Copy of ${sourceTree.name}`;

        await db.transaction(async (tx) => {
            // 1. Create New Tree
            await tx.insert(familyTrees).values({
                id: newTreeId,
                ownerId: userId, // Current user becomes owner of copy
                name: newName,
                description: sourceTree.description,
                createdAt: now,
                updatedAt: now,
            });

            // Add permissions for new owner
            await tx.insert(permissions).values({
                id: crypto.randomUUID(),
                familyTreeId: newTreeId,
                userId: userId,
                role: 'owner',
                createdAt: now
            });

            // 2. Fetch all data from source tree
            const sourcePeople = await tx.select().from(people).where(eq(people.familyTreeId, sourceTreeId));
            const sourceRelationships = await tx.select().from(relationships).where(eq(relationships.familyTreeId, sourceTreeId));
            // Events are linked to people. We need to fetch all events for these people.
            // Or select * from events where person_id in (sourcePeopleIds)

            // 3. Map Old IDs to New IDs
            const personIdMap = new Map<string, string>();

            // Insert People
            for (const p of sourcePeople) {
                const newId = crypto.randomUUID();
                personIdMap.set(p.id, newId);

                await tx.insert(people).values({
                    ...p,
                    id: newId,
                    familyTreeId: newTreeId,
                    createdAt: now,
                    updatedAt: now
                });

                // Copy events for this person
                const pEvents = await tx.select().from(events).where(eq(events.personId, p.id));
                for (const e of pEvents) {
                    await tx.insert(events).values({
                        ...e,
                        id: crypto.randomUUID(),
                        personId: newId, // Link to new person ID
                        createdAt: now
                    });
                }
            }

            // Insert Relationships
            for (const r of sourceRelationships) {
                // Only copy if both parties exist in the map (should be true)
                const newFromId = personIdMap.get(r.fromPersonId || '');
                const newToId = personIdMap.get(r.toPersonId || '');

                if (newFromId && newToId) {
                    await tx.insert(relationships).values({
                        ...r,
                        id: crypto.randomUUID(),
                        familyTreeId: newTreeId,
                        fromPersonId: newFromId,
                        toPersonId: newToId,
                        createdAt: now
                    });
                }
            }
        });

        return c.json({ id: newTreeId, name: newName }, 201);
    } catch (error: any) {
        console.error('Duplicate error:', error);
        return c.json({ error: error.message }, 500);
    }
});

// Delete family tree
app.delete('/:id', async (c) => {
    const userId = c.get('userId') as string;
    const treeId = c.req.param('id');

    try {
        // Verify ownership
        const tree = await db.select().from(familyTrees).where(eq(familyTrees.id, treeId)).get();
        if (!tree) return c.json({ error: 'Tree not found' }, 404);

        if (tree.ownerId !== userId) {
            return c.json({ error: 'Forbidden' }, 403);
        }

        // Manual cleanup if Cascade doesn't fire (SQLite foreign keys must be enabled, but just in case)
        await db.delete(familyTrees).where(eq(familyTrees.id, treeId));

        return c.json({ success: true, id: treeId });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

export default app;
