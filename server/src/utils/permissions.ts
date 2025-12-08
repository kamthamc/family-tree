import { db } from '../db';
import { permissions, familyTrees } from '../db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Check if user has access to a specific family tree
 */
export async function checkAccess(userId: string, familyTreeId: string): Promise<boolean> {
    if (!userId || !familyTreeId) return false;

    // Check permissions table
    const perm = await db.query.permissions.findFirst({
        where: and(
            eq(permissions.userId, userId),
            eq(permissions.familyTreeId, familyTreeId)
        )
    });

    if (perm) return true;

    // Fallback: Check if owner (should be in permissions table, but just in case)
    const tree = await db.query.familyTrees.findFirst({
        where: and(
            eq(familyTrees.id, familyTreeId),
            eq(familyTrees.ownerId, userId)
        )
    });

    return !!tree;
}
