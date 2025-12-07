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

export function buildGraph(people: Person[], relationships: Relationship[]): Map<string, GraphNode> {
    const graph = new Map<string, GraphNode>();

    // Initialize nodes
    people.forEach(p => {
        graph.set(p.id, { id: p.id, connections: [] });
    });

    // derived sibling relationships (shared parents)
    const parentMap = new Map<string, string[]>(); // childId -> parentIds

    relationships.forEach(rel => {
        if (rel.type === 'parent') {
            // Parent -> Child
            const parentNode = graph.get(rel.fromPersonId);
            if (parentNode) {
                parentNode.connections.push({ targetId: rel.toPersonId, type: 'child' });
            }

            // Child -> Parent
            const childNode = graph.get(rel.toPersonId);
            if (childNode) {
                childNode.connections.push({ targetId: rel.fromPersonId, type: 'parent' });
            }

            // Track for sibling derivation
            if (!parentMap.has(rel.toPersonId)) {
                parentMap.set(rel.toPersonId, []);
            }
            parentMap.get(rel.toPersonId)!.push(rel.fromPersonId);
        } else if (rel.type === 'spouse') {
            const p1 = graph.get(rel.fromPersonId);
            const p2 = graph.get(rel.toPersonId);
            if (p1) p1.connections.push({ targetId: rel.toPersonId, type: 'spouse' });
            if (p2) p2.connections.push({ targetId: rel.fromPersonId, type: 'spouse' });
        }
    });

    // Add sibling connections
    // Two people are siblings if they share at least one parent
    const peopleIds = Array.from(graph.keys());
    for (let i = 0; i < peopleIds.length; i++) {
        for (let j = i + 1; j < peopleIds.length; j++) {
            const id1 = peopleIds[i];
            const id2 = peopleIds[j];
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

        if (id === endId) {
            return path;
        }

        const node = graph.get(id);
        if (!node) continue;

        for (const conn of node.connections) {
            if (!visited.has(conn.targetId)) {
                visited.add(conn.targetId);
                queue.push({
                    id: conn.targetId,
                    path: [...path, { personId: conn.targetId, relType: conn.type }]
                });
            }
        }
    }

    return null;
}

// Convert a path of types into a human readable string
// e.g. parent -> parent -> brother = Great Uncle
export function describeRelationship(path: PathStep[], people: Person[]): string {
    // Helper to get person details safely
    const personMap = new Map(people.map(p => [p.id, p]));
    const getPerson = (step: PathStep) => personMap.get(step.personId);

    // Helper to calculate age difference with Father
    // Returns true if person is Older than reference (Father)
    const isOlderThan = (p1: Person, p2: Person) => {
        if (!p1.birthDate || !p2.birthDate) return false; // Default to false if unknown
        return new Date(p1.birthDate) < new Date(p2.birthDate);
    };

    // Analyze specific Telugu patterns
    // We walk the path and check gender flows

    // 0. Self
    if (path.length === 1 && path[0].relType === 'self') return 'Self';

    const steps = path.map(s => ({ ...s, person: getPerson(s) }));
    if (steps.some(s => !s.person)) return 'Unknown'; // Should not happen given logic

    // Basic terms
    const target = steps[steps.length - 1].person!;
    // const start = steps[0].person!; // Usually 'personA' effectively (but path starts from personA... wait path is steps relative to start?)
    // path structure: [{personId: A, relType: self}, {personId: B, relType: parent}...]
    // So steps[0] is Start Person. steps[1] is relation relative to Start.

    // NOTE: The previous logic assumed path was just steps. Let's verify structure.
    // findRelationshipPath returns [{personId: start, relType: 'self'}, {personId: next, relType: 'child'}...]
    // So steps[0] is always Self.

    if (steps.length < 2) return 'Self';

    // Extract sequence of relations IGNORING 'self' at index 0
    const rels = steps.slice(1);

    // --- Telugu Specific Checks ---

    // Helper to check genders in chain

    // 1. Paternal Grandmother (Nanamma)
    // Father (M) -> Mother (F) or Father (M) -> Parent (F)
    if (rels.length === 2 && rels[0].relType === 'parent' && rels[1].relType === 'parent') {
        const p1 = rels[0].person!;
        const p2 = rels[1].person!;
        if (p1.gender === 'male' && p2.gender === 'female') return 'Nanamma (Paternal Grandmother)';
    }

    // 2. Maternal Grandmother (Ammama)
    // Mother (F) -> Mother (F)
    if (rels.length === 2 && rels[0].relType === 'parent' && rels[1].relType === 'parent') {
        const p1 = rels[0].person!;
        const p2 = rels[1].person!;
        if (p1.gender === 'female' && p2.gender === 'female') return 'Ammama (Maternal Grandmother)';
    }

    // 3. Atha (Paternal Aunt)
    // Father (M) -> Sibling (F)
    if (rels.length === 2 && rels[0].relType === 'parent' && rels[1].relType === 'sibling') {
        const father = rels[0].person!;
        const aunt = rels[1].person!;
        if (father.gender === 'male' && aunt.gender === 'female') return 'Atha (Paternal Aunt)';
    }

    // 4. Maama (Maternal Uncle)
    // Mother (F) -> Sibling (M)
    // Path: Self -> Parent(F) -> Sibling(M)
    if (rels.length === 2 && rels[0].relType === 'parent' && rels[1].relType === 'sibling') {
        const mother = rels[0].person!;
        const uncle = rels[1].person!;
        if (mother.gender === 'female' && uncle.gender === 'male') return 'Maama (Maternal Uncle)';
    }

    // 5. Babai / Pednanna (Paternal Uncle)
    // Father (M) -> Sibling (M)
    if (rels.length === 2 && rels[0].relType === 'parent' && rels[1].relType === 'sibling') {
        const father = rels[0].person!;
        const uncle = rels[1].person!;
        // Paternal Uncle
        if (father.gender === 'male' && uncle.gender === 'male') {
            // Check Age vs Father
            if (isOlderThan(uncle, father)) {
                return 'Pednanna (Older Paternal Uncle)';
            } else {
                return 'Babai (Younger Paternal Uncle)';
            }
        }
    }

    // 6. Pinni / Peddamma (Maternal Aunt)
    // Mother (F) -> Sibling (F)
    if (rels.length === 2 && rels[0].relType === 'parent' && rels[1].relType === 'sibling') {
        const mother = rels[0].person!;
        const aunt = rels[1].person!;
        if (mother.gender === 'female' && aunt.gender === 'female') {
            if (isOlderThan(aunt, mother)) {
                return 'Peddamma (Older Maternal Aunt)';
            } else {
                return 'Pinni (Younger Maternal Aunt)';
            }
        }
    }

    // 7. Pinni (Father's Brother's Wife)
    // Father (M) -> Sibling (M) -> Spouse (F)
    if (rels.length === 3 && rels[0].relType === 'parent' && rels[1].relType === 'sibling' && rels[2].relType === 'spouse') {
        const father = rels[0].person!;
        const uncle = rels[1].person!; // Brother

        if (father.gender === 'male' && uncle.gender === 'male') {
            if (isOlderThan(uncle, father)) {
                return 'Peddamma (Wife of Pednanna)';
            } else {
                return 'Pinni (Wife of Babai)';
            }
        }
    }

    // 8. Maradalu / Bava / Vadina etc (Cross Cousins)
    // Case A: Maternal Uncle's Child
    // Mother (F) -> Sibling (M) -> [Spouse ->] Child
    // Logic: Look for Parent(F) -> ... -> Child
    // Actually simpler:
    // Parent(F) -> Sibling(M) -> Child OR Parent(F) -> Sibling(M) -> Spouse -> Child

    // Let's normalize cousin paths.
    // If we have Parent -> Sibling -> Spouse -> Child, it's effectively Parent -> Sibling -> Child (Cousin) 
    // but we need to check the gender of the Sibling to distinguish Cross vs Parallel.

    // We can detect "Cousin" pattern first.
    let parentStep: PathStep | null = null;
    let siblingStep: PathStep | null = null;
    let childStep: PathStep | null = null;

    // Pattern 1: Parent -> Sibling -> Child
    if (rels.length === 3 && rels[0].relType === 'parent' && rels[1].relType === 'sibling' && rels[2].relType === 'child') {
        parentStep = rels[0];
        siblingStep = rels[1];
        childStep = rels[2];
    }
    // Pattern 2: Parent -> Sibling -> Spouse -> Child
    else if (rels.length === 4 && rels[0].relType === 'parent' && rels[1].relType === 'sibling' && rels[2].relType === 'spouse' && rels[3].relType === 'child') {
        parentStep = rels[0];
        siblingStep = rels[1];
        // spouse is rels[2]
        childStep = rels[3];
    }

    if (parentStep && siblingStep && childStep) {
        const parent = parentStep.person!;
        const sibling = siblingStep.person!; // The aunt/uncle
        const cousin = childStep.person!;

        const parentGender = parent.gender;
        const siblingGender = sibling.gender;

        // Parallel Cousin: Parent and their SAME-gender sibling's child
        // Father (M) + Father's Brother (M) → Parallel
        // Mother (F) + Mother's Sister (F) → Parallel
        // Cross Cousin: Parent and their DIFFERENT-gender sibling's child  
        // Father (M) + Father's Sister (F) → Cross
        // Mother (F) + Mother's Brother (M) → Cross

        const isParallelCousin = (parentGender === siblingGender);

        if (isParallelCousin) {
            // Parallel Cousin → Treat as Sibling
            const selfPerson = steps[0].person!;
            const isOlder = isOlderThan(cousin, selfPerson);

            if (cousin.gender === 'male') {
                return isOlder ? 'Anna (Older Brother)' : 'Thammudu (Younger Brother)';
            } else {
                return isOlder ? 'Akka (Older Sister)' : 'Chelli (Younger Sister)';
            }
        } else {
            // Cross Cousin → Marriageable relations
            const selfPerson = steps[0].person!;
            const isOlder = isOlderThan(cousin, selfPerson);
            const selfMale = selfPerson.gender === 'male';
            const cousinMale = cousin.gender === 'male';

            if (selfMale) {
                if (cousinMale) {
                    // Male → Male Cross Cousin
                    return isOlder ? 'Bava (Older Brother-in-law)' : 'Bava Maridi (Younger Brother-in-law)';
                } else {
                    // Male → Female Cross Cousin
                    return isOlder ? 'Vadina (Older Sister-in-law)' : 'Maradalu (Younger Sister-in-law)';
                }
            } else {
                // Self is Female
                if (cousinMale) {
                    // Female → Male Cross Cousin
                    return isOlder ? 'Bava (Older Brother-in-law)' : 'Baamardhi (Younger Brother-in-law)';
                } else {
                    // Female → Female Cross Cousin
                    return isOlder ? 'Vadina (Older Sister-in-law)' : 'Maradalu (Younger Sister-in-law)';
                }
            }
        }
    }

    // Sibling's Spouse (Brother-in-law / Sister-in-law)
    // Sibling -> Spouse
    if (rels.length === 2 && rels[0].relType === 'sibling' && rels[1].relType === 'spouse') {
        const sibling = rels[0].person!;
        const spouse = rels[1].person!;

        // If sibling is male, spouse is wife → Vadina
        // If sibling is female, spouse is husband → Baava
        if (sibling.gender === 'male' && spouse.gender === 'female') {
            return 'Vadina (Sister-in-law)';
        } else if (sibling.gender === 'female' && spouse.gender === 'male') {
            return 'Baava (Brother-in-law)';
        }
    }


    // --- Fallback to English Logic ---
    const types = rels.map(r => r.relType);
    const isMale = target.gender === 'male';
    const isFemale = target.gender === 'female';

    // Direct relationships
    if (types.length === 1) {
        const t = types[0];
        if (t === 'parent') return isMale ? 'Father (Nanna)' : (isFemale ? 'Mother (Amma)' : 'Parent');
        if (t === 'child') return isMale ? 'Son (Koduku)' : (isFemale ? 'Daughter (Koothuku)' : 'Child');
        if (t === 'spouse') return isMale ? 'Husband (Bharta)' : (isFemale ? 'Wife (Bharya)' : 'Spouse');
        if (t === 'sibling') {
            // Check age for Anna/Thammudu/Akka/Chelli
            const startPerson = steps[0].person!;
            const older = isOlderThan(target, startPerson);
            if (isMale) return older ? 'Brother (Anna)' : 'Brother (Thammudu)';
            if (isFemale) return older ? 'Sister (Akka)' : 'Sister (Chelli)';
            return 'Sibling';
        }
    }

    // Grandparents
    if (types.every(t => t === 'parent')) {
        const depth = types.length;
        if (depth === 2) return isMale ? 'Grandfather (Thatha)' : (isFemale ? 'Grandmother (Avva/Nanakamma)' : 'Grandparent');
    }

    // Default construction
    return path.map((step, idx) => {
        const p = personMap.get(step.personId);
        const g = p?.gender;
        const type = step.relType;
        let label: string = type;

        switch (type) {
            case 'parent': label = (g === 'male' ? 'Father' : (g === 'female' ? 'Mother' : 'Parent')); break;
            case 'child': label = (g === 'male' ? 'Son' : (g === 'female' ? 'Daughter' : 'Child')); break;
            case 'spouse': label = (g === 'male' ? 'Husband' : (g === 'female' ? 'Wife' : 'Spouse')); break;
            case 'sibling': label = (g === 'male' ? 'Brother' : (g === 'female' ? 'Sister' : 'Sibling')); break;
        }

        return idx === path.length - 1 ? label : `${label}'s`;
    }).join(' ');
}
