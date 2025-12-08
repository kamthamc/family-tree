import type { Person, Relationship } from '../api';

export type RelationType = 'parent' | 'child' | 'spouse' | 'sibling' | 'self';

interface GraphNode {
    id: string;
    connections: {
        targetId: string;
        type: RelationType;
    }[];
}

export interface PathStep {
    personId: string;
    relType: RelationType;
    person?: Person; // Hydrated later
}

// Build a graph of connections including derived siblinghood
export function buildGraph(people: Person[], relationships: Relationship[]): Map<string, GraphNode> {
    const graph = new Map<string, GraphNode>();

    // Initialize nodes
    people.forEach(p => {
        graph.set(p.id, { id: p.id, connections: [] });
    });

    const parentMap = new Map<string, string[]>(); // childId -> parentIds

    relationships.forEach(rel => {
        if (rel.type === 'parent') {
            // Parent -> Child
            graph.get(rel.fromPersonId)?.connections.push({ targetId: rel.toPersonId, type: 'child' });
            // Child -> Parent
            graph.get(rel.toPersonId)?.connections.push({ targetId: rel.fromPersonId, type: 'parent' });

            if (!parentMap.has(rel.toPersonId)) parentMap.set(rel.toPersonId, []);
            parentMap.get(rel.toPersonId)!.push(rel.fromPersonId);
        } else if (rel.type === 'spouse') {
            graph.get(rel.fromPersonId)?.connections.push({ targetId: rel.toPersonId, type: 'spouse' });
            graph.get(rel.toPersonId)?.connections.push({ targetId: rel.fromPersonId, type: 'spouse' });
        }
    });

    // Derive Sibling connections (share at least one parent)
    const peopleChecker = Array.from(graph.keys());
    for (let i = 0; i < peopleChecker.length; i++) {
        for (let j = i + 1; j < peopleChecker.length; j++) {
            const id1 = peopleChecker[i];
            const id2 = peopleChecker[j];
            const p1Parents = parentMap.get(id1) || [];
            const p2Parents = parentMap.get(id2) || [];

            const sharedParent = p1Parents.some(p => p2Parents.includes(p));
            if (sharedParent) {
                graph.get(id1)?.connections.push({ targetId: id2, type: 'sibling' });
                graph.get(id2)?.connections.push({ targetId: id1, type: 'sibling' });
            }
        }
    }

    return graph;
}

// BFS to find shortest path
export function findRelationshipPath(
    startId: string,
    endId: string,
    people: Person[],
    relationships: Relationship[]
): PathStep[] | null {
    if (startId === endId) return [{ personId: startId, relType: 'self' }];

    const graph = buildGraph(people, relationships);
    const queue: { id: string; path: PathStep[] }[] = [{ id: startId, path: [{ personId: startId, relType: 'self' }] }];
    const visited = new Set<string>([startId]);

    while (queue.length > 0) {
        const { id, path } = queue.shift()!;
        if (id === endId) return path;

        const node = graph.get(id);
        if (!node) continue;

        for (const conn of node.connections) {
            if (!visited.has(conn.targetId)) {
                visited.add(conn.targetId);
                // Optimization: don't go too deep? Max depth 5?
                if (path.length > 6) continue;
                queue.push({
                    id: conn.targetId,
                    path: [...path, { personId: conn.targetId, relType: conn.type }]
                });
            }
        }
    }
    return null;
}

// Helper: Age check
const isOlderThan = (p1: Person, p2: Person) => {
    if (!p1.birthDate || !p2.birthDate) return false;
    return new Date(p1.birthDate) < new Date(p2.birthDate);
};

export function describeRelationship(path: PathStep[], people: Person[]): string {
    if (!path || path.length < 2) return 'Self';

    const personMap = new Map(people.map(p => [p.id, p]));
    const steps = path.map(s => ({ ...s, person: personMap.get(s.personId)! }));

    // Normalize Path logic:
    // We want to simplify "Mother's Husband" -> "Father"
    // "Brother's Wife" -> "Sister-in-law"
    // But we need to keep the "in-law" distinction for the final label sometimes.

    // Let's analyze the chain of Core Relations.

    // 0 is Self. 
    // 1 is relation A to Self.
    // 2 is relation B to A.

    const target = steps[steps.length - 1].person;
    const self = steps[0].person;
    const targetGender = target.gender;

    // Helper for labels
    const getLabel = (type: string, gender: string, isOlder: boolean) => {
        const isMale = gender === 'male';

        switch (type) {
            case 'parent': return isMale ? 'Father (Nanna)' : 'Mother (Amma)';
            case 'child': return isMale ? 'Son (Koduku)' : 'Daughter (Koothuru)';
            case 'spouse': return isMale ? 'Husband (Bharta)' : 'Wife (Bharya)';
            case 'sibling':
                if (isMale) return isOlder ? 'Brother (Anna)' : 'Brother (Thammudu)';
                return isOlder ? 'Sister (Akka)' : 'Sister (Chelli)';
        }
        return type;
    };

    // --- Path Analysis ---

    // Exclude 'self'
    const rels = steps.slice(1);

    // Check for "Parent -> Spouse" pattern and merge it into "Parent" (Step-parent or Parent)
    // If I have Parent(A) -> Spouse(B), B is effectively a Parent.
    // NOTE: This handles "Mother's husband" -> "Father".

    const normalizedRels: { type: RelationType, person: Person }[] = [];

    for (let i = 0; i < rels.length; i++) {
        const current = rels[i];

        // Look ahead for Spouse of Parent
        if (normalizedRels.length > 0) {
            const prev = normalizedRels[normalizedRels.length - 1];
            if (prev.type === 'parent' && current.relType === 'spouse') {
                // Parent -> Spouse
                // Treat as Parent
                // Replace previous parent with this new parent node? 
                // No, we append as a "Parent" step, but wait, usually "Mother's Husband" IS the father link.
                // If the graph found "Mother -> Husband", it means there was no direct "Father" link or BFS took this path.
                // We treat this step as 'parent'.
                normalizedRels.push({ type: 'parent', person: current.person! });
                continue;
            }
        }
        normalizedRels.push({ type: current.relType, person: current.person! });
    }

    // Now analyze the normalized chain
    const types = normalizedRels.map(r => r.type);
    const depth = types.length;

    // Direct
    if (depth === 1) {
        return getLabel(types[0], targetGender || 'other', isOlderThan(target, self));
    }

    // Grandparents & Greats
    if (types.every(t => t === 'parent')) {
        if (depth === 2) {
            // Paternal vs Maternal?
            // Ask the first parent.
            const p1 = normalizedRels[0].person;
            if (p1.gender === 'male') return targetGender === 'male' ? 'Paternal Grandfather (Thatha)' : 'Paternal Grandmother (Nanamma)';
            return targetGender === 'male' ? 'Maternal Grandfather (Thatha)' : 'Maternal Grandmother (Ammama)';
        }
        return `Great-`.repeat(depth - 2) + `Grandparent`;
    }

    // Aunt/Uncle
    // Parent -> Sibling
    if (depth === 2 && types[0] === 'parent' && types[1] === 'sibling') {
        const parent = normalizedRels[0].person;
        const sibling = normalizedRels[1].person; // The aunt/uncle

        if (parent.gender === 'male') {
            // Paternal
            if (sibling.gender === 'male') {
                // Father's Brother
                return isOlderThan(sibling, parent) ? 'Pednanna (Big Father)' : 'Babai (Small Father)';
            } else {
                // Father's Sister
                return 'Atha (Paternal Aunt)';
            }
        } else {
            // Maternal
            if (sibling.gender === 'male') {
                // Mother's Brother
                return 'Maama (Maternal Uncle)';
            } else {
                // Mother's Sister
                return isOlderThan(sibling, parent) ? 'Peddamma (Big Mother)' : 'Pinni (Small Mother)';
            }
        }
    }

    // Cousins (Child of Aunt/Uncle)
    // Parent -> Sibling -> Child
    if (depth === 3 && types[0] === 'parent' && types[1] === 'sibling' && types[2] === 'child') {
        const parent = normalizedRels[0].person;
        const sibling = normalizedRels[1].person;
        const cousin = normalizedRels[2].person;

        const isParallel = parent.gender === sibling.gender;
        const isOlder = isOlderThan(cousin, self);

        if (isParallel) {
            // Parallel Cousin (Father's Brother's Child OR Mother's Sister's Child) -> Sibling terms
            if (cousin.gender === 'male') return isOlder ? 'Cousin Brother (Anna)' : 'Cousin Brother (Thammudu)';
            return isOlder ? 'Cousin Sister (Akka)' : 'Cousin Sister (Chelli)';
        } else {
            // Cross Cousin (Father's Sister's Child OR Mother's Brother's Child) -> Bava/Vadina/etc
            const selfMale = self.gender === 'male';
            const cousinMale = cousin.gender === 'male';

            if (selfMale) {
                if (cousinMale) return isOlder ? 'Bava (Cross Cousin)' : 'Bava Maridi (Cross Cousin)'; // Male-Male Cross
                return isOlder ? 'Vadina (Cross Cousin)' : 'Maradalu (Cross Cousin)'; // Male-Female Cross
            } else {
                if (cousinMale) return isOlder ? 'Bava (Cross Cousin)' : 'Baamardhi (Cross Cousin)'; // Female-Male Cross
                return isOlder ? 'Vadina (Cross Cousin)' : 'Maradalu (Cross Cousin)'; // Female-Female Cross
            }
        }
    }

    // Uncle's Wife / Aunt's Husband
    // Parent -> Sibling -> Spouse
    if (depth === 3 && types[0] === 'parent' && types[1] === 'sibling' && types[2] === 'spouse') {
        const parent = normalizedRels[0].person;
        const sibling = normalizedRels[1].person;


        // Father's Brother's Wife -> Pinni/Peddamma
        if (parent.gender === 'male' && sibling.gender === 'male') {
            return isOlderThan(sibling, parent) ? 'Peddamma (Wife of Pednanna)' : 'Pinni (Wife of Babai)';
        }
        // Mother's Sister's Husband -> Babai/Pednanna
        if (parent.gender === 'female' && sibling.gender === 'female') {
            return isOlderThan(sibling, parent) ? 'Pednanna (Husband of Peddamma)' : 'Babai (Husband of Pinni)';
        }

        // Father's Sister's Husband -> Maama
        if (parent.gender === 'male' && sibling.gender === 'female') return 'Maama (Husband of Atha)';

        // Mother's Brother's Wife -> Atha
        if (parent.gender === 'female' && sibling.gender === 'male') return 'Atha (Wife of Maama)';
    }

    // Niece/Nephew
    // Sibling -> Child
    if (depth === 2 && types[0] === 'sibling' && types[1] === 'child') {
        return targetGender === 'male' ? 'Nephew' : 'Niece';
        // Telugu specifics exist but simplified for now
    }

    // In-Laws (Spouse -> Parent)
    if (depth === 2 && types[0] === 'spouse' && types[1] === 'parent') {
        return targetGender === 'male' ? 'Father-in-law (Maamayya)' : 'Mother-in-law (Athamma)';
    }

    // Sibling-in-law (Spouse -> Sibling)
    if (depth === 2 && types[0] === 'spouse' && types[1] === 'sibling') {
        const spouse = normalizedRels[0].person;
        // My Wife's Brother -> Bava Maridi
        // My Husband's Brother -> Maridi
        const selfMale = self.gender === 'male';
        const targetMale = targetGender === 'male';
        if (selfMale) { // I am husband, Spouse is Wife
            if (targetMale) return 'Brother-in-law (Baamayya/Bava Maridi)';
            return 'Sister-in-law (Maradalu)'; // Wife's sister
        } else { // I am wife, Spouse is Husband
            if (targetMale) return isOlderThan(target, spouse) ? 'Brother-in-law (Bava)' : 'Brother-in-law (Maridi)';
            return 'Sister-in-law (Aadapaduchu)'; // Husband's sister
        }
    }

    // Sibling -> Spouse
    if (depth === 2 && types[0] === 'sibling' && types[1] === 'spouse') {
        const sibling = normalizedRels[0].person;

        // Brother's Wife -> Vadina
        // Sister's Husband -> Bava
        if (sibling.gender === 'male') return 'Sister-in-law (Vadina)';
        if (sibling.gender === 'female') return 'Brother-in-law (Bava)';
    }

    // Fallback
    return types.join(' -> ');
}
