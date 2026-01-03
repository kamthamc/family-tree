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
                if (path.length > 12) continue;
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

    const target = steps[steps.length - 1].person;
    const self = steps[0].person;

    // Analyze path for classic Up/Down structure (Blood Relations)
    // A classic blood relation path goes UP to a Common Ancestor, then DOWN to target.
    // It should look like: [Self, Parent, Parent..., (Common Ancestor), Child, Child..., Target]
    // Or just Up (Ancestor), or just Down (Descendant).
    // It should NOT have 'spouse' (except maybe at the very end for in-laws).

    let isBloodPath = true;
    let upSteps = 0;
    let downSteps = 0;
    let switchDirection = false; // False = moving UP, True = moving DOWN

    // Check transitions
    // We start at Self (index 0).
    // Step 1: relType is relationship of Node 1 relative to Node 0.
    // Logic: 
    // - parent: moving UP
    // - child: moving DOWN
    // - sibling: UP then DOWN (1 up, 1 down implied) 
    // - spouse: Lateral (breaks pure blood line usually, unless consanguineous)

    // Actually, let's just count.

    // Special handling for "Sibling" step in the path: 
    // A Sibling step replaces "Parent -> Child".
    // If we see 'sibling', it adds 1 Up and 1 Down effectively.

    for (let i = 1; i < steps.length; i++) {
        const type = steps[i].relType;
        if (type === 'spouse') {
            isBloodPath = false;
            // loop continues to check complex in-laws
        }

        if (type === 'parent') {
            if (switchDirection) {
                // We were going down, now going up? Zig-zag. Not simple LCA path.
                isBloodPath = false;
            }
            upSteps++;
        } else if (type === 'child') {
            switchDirection = true; // Started going down
            downSteps++;
        } else if (type === 'sibling') {
            if (switchDirection) isBloodPath = false;
            upSteps++;
            downSteps++;
            switchDirection = true;
        }
    }

    // --- blood relations ---
    if (isBloodPath) {
        const isMale = target.gender === 'male';
        const genderLabel = (m: string, f: string) => isMale ? m : f;

        // Direct Ancestors/Descendants
        if (downSteps === 0) {
            // Ancestors
            if (upSteps === 1) return genderLabel('Father', 'Mother');
            if (upSteps === 2) return genderLabel('Grandfather', 'Grandmother');
            if (upSteps === 3) return genderLabel('Great-Grandfather', 'Great-Grandmother');
            if (upSteps > 3) return `${'Great-'.repeat(upSteps - 2)}Grandparent`;
        }
        if (upSteps === 0) {
            // Descendants
            if (downSteps === 1) return genderLabel('Son', 'Daughter');
            if (downSteps === 2) return genderLabel('Grandson', 'Granddaughter');
            if (downSteps === 3) return genderLabel('Great-Grandson', 'Great-Granddaughter');
            if (downSteps > 3) return `${'Great-'.repeat(downSteps - 2)}Grandchild`;
        }

        // Siblings
        if (upSteps === 1 && downSteps === 1) {
            const older = isOlderThan(target, self);
            if (isMale) return older ? 'Brother (Anna)' : 'Brother (Thammudu)';
            return older ? 'Sister (Akka)' : 'Sister (Chelli)';
        }

        // Aunt/Uncle and Niece/Nephew
        if (upSteps === 2 && downSteps === 1) {
            // Parent's Sibling -> Aunt/Uncle
            // Need to know WHICH side (Paternal/Maternal) for exact terms
            // Scan path: Self -> Parent (check gender) -> Sibling (Target)
            const parent = steps[1].person;
            const isPaternal = parent.gender === 'male';

            if (isMale) {
                // Uncle
                if (isPaternal) {
                    // Father's Brother
                    return isOlderThan(target, parent) ? 'Uncle (Pednanna - Father\'s Big Bro)' : 'Uncle (Babai - Father\'s Little Bro)';
                } else {
                    // Mother's Brother
                    return 'Uncle (Maama - Maternal)';
                }
            } else {
                // Aunt
                if (isPaternal) {
                    // Father's Sister
                    return 'Aunt (Atha - Paternal)';
                } else {
                    // Mother's Sister
                    return isOlderThan(target, parent) ? 'Aunt (Peddamma - Mother\'s Big Sis)' : 'Aunt (Pinni - Mother\'s Little Sis)';
                }
            }
        }

        if (upSteps === 1 && downSteps === 2) {
            // Sibling's Child -> Niece/Nephew
            // Apply Parallel vs Cross logic here too
            // Self -> Sibling -> Child
            // steps[0] = Self, steps[1] = Parent (skipped in path logic?), wait.
            // steps path structure:
            // Sibling logic: upSteps=1, downSteps=1 implies Self -> Parent -> Sibling.
            // Sibling's Child: upSteps=1, downSteps=2 implies Self -> Parent -> Sibling -> Child.
            // No, my describeRelationship creates logic based on up/down counts.

            // To check Parallel/Cross, we need the Sibling node.
            // Path: Self -> Parent -> Sibling -> Child.
            // steps[2] is the Sibling (if path is explicitly Self->Parent->Sibling->Child)
            // But 'sibling' relType jump might simplify it?

            // If path uses 'sibling' edge: Self -> Sibling -> Child.
            // steps[1].relType = 'sibling'. steps[2].relType = 'child'.
            // Sibling is steps[1].person.

            // Check if we can find the sibling node reliably.
            // We iterate steps. 
            // If upSteps=1, downSteps=2.
            // This logic is generic. Let's find the Sibling node in the path.

            // Finding the node where we switch from Up to Down? 
            // Or if 'sibling' type was used?

            // Let's rely on finding the Sibling node.
            // It's the parent of the Target.
            // Target is steps[last]. Parent of Target is steps[last-1].
            const siblingNode = steps[steps.length - 2].person;

            const isParallel = self.gender === siblingNode.gender;
            const isTargetMale = target.gender === 'male';

            if (isParallel) {
                return isTargetMale ? 'Nephew (Varasa Koduku)' : 'Niece (Varasa Kuthuru)';
                // Or just Koduku/Kuthuru? 
                // In English calling your brother's son "Son" is very weird. "Nephew" is correct.
                // But user wants "Koduku". "Varasa Koduku" implies "Terminological Son".
            } else {
                return isTargetMale ? 'Nephew (Menalludu)' : 'Niece (Menakodalu)';
            }
        }

        // Cousins
        // up >= 2, down >= 2
        // Degree = min(up, down) - 1
        // Removal = abs(up - down)
        if (upSteps >= 2 && downSteps >= 2) {
            const degree = Math.min(upSteps, downSteps) - 1;
            const removal = Math.abs(upSteps - downSteps);

            const degreeStr = `${degree}${degree === 1 ? 'st' : (degree === 2 ? 'nd' : (degree === 3 ? 'rd' : 'th'))}`;
            const removalStr = removal === 0 ? '' : (removal === 1 ? ' Once Removed' : (removal === 2 ? ' Twice Removed' : ` ${removal} Times Removed`));

            let label = `${degreeStr} Cousin${removalStr}`;

            // Vernacular for First Cousins (up=2, down=2)
            if (upSteps === 2 && downSteps === 2) {
                // Check Parallel vs Cross
                // Self -> Parent -> GP -> ParentSib -> Cousin
                const parent = steps[1].person;
                // Steps[2] is GP.
                // Steps[3] is ParentSibling (Aunt/Uncle)
                const parentSibling = steps[3].person;

                const isParallel = parent.gender === parentSibling.gender;
                const older = isOlderThan(target, self);

                if (isParallel) {
                    // Parallel: Sibling terms
                    const vTerm = isMale ? (older ? 'Anna' : 'Thammudu') : (older ? 'Akka' : 'Chelli');
                    label += ` (${vTerm})`;
                } else {
                    // Cross
                    const vTerm = isMale ? 'Bava/Baamardhi' : 'Vadina/Maradalu';
                    label += ` (${vTerm})`;
                }
            }

            return label;
        }

        // Great Aunt/Uncle
        if (upSteps > 2 && downSteps === 1) {
            const greatLevel = upSteps - 2;
            const greatStr = 'Great-'.repeat(greatLevel);
            return `${greatStr}${genderLabel('Uncle', 'Aunt')}`;
        }
    }

    // --- In-Laws / Step Relations ---

    // Direct Spouse
    if (steps.length === 2 && steps[1].relType === 'spouse') {
        return target.gender === 'male' ? 'Husband' : 'Wife';
    }

    // Father-in-law / Mother-in-law (Spouse -> Parent)
    if (steps.length === 3 && steps[1].relType === 'spouse' && steps[2].relType === 'parent') {
        return target.gender === 'male' ? 'Father-in-law (Maamayya)' : 'Mother-in-law (Athamma)';
    }

    // Son-in-law / Daughter-in-law (Child -> Spouse)
    if (steps.length === 3 && steps[1].relType === 'child' && steps[2].relType === 'spouse') {
        return target.gender === 'male' ? 'Son-in-law' : 'Daughter-in-law';
    }

    // Brother/Sister-in-law
    // 1. Spouse -> Sibling
    if (steps.length === 3 && steps[1].relType === 'spouse' && steps[2].relType === 'sibling') {
        return target.gender === 'male' ? 'Brother-in-law' : 'Sister-in-law';
    }
    // 2. Sibling -> Spouse
    if (steps.length === 3 && steps[1].relType === 'sibling' && steps[2].relType === 'spouse') {
        return target.gender === 'male' ? 'Brother-in-law' : 'Sister-in-law';
    }

    // Co-brother / Co-sister (Spouse -> Sibling -> Spouse)
    if (steps.length === 4 && steps[1].relType === 'spouse' && steps[2].relType === 'sibling' && steps[3].relType === 'spouse') {
        return target.gender === 'male' ? 'Co-Brother (Todu Alludu)' : 'Co-Sister (Todu Kodalu)';
    }

    // Spouse -> Sibling -> Child (Niece/Nephew by marriage)
    if (steps.length === 4 && steps[1].relType === 'spouse' && steps[2].relType === 'sibling' && steps[3].relType === 'child') {
        const spouse = steps[1].person;
        const sibling = steps[2].person; // Spouse's sibling

        // Parallel (Same Gender) vs Cross (Diff Gender) Siblings Logic
        // In Telugu/Dravidian kinship:
        // - Husband's Brother's Child -> Son (Koduku) / Daughter (Kuthuru)
        // - Husband's Sister's Child -> Nephew (Menalludu) / Niece (Menakodalu)
        // - Wife's Sister's Child -> Son (Koduku) / Daughter (Kuthuru)
        // - Wife's Brother's Child -> Nephew (Menalludu) / Niece (Menakodalu)

        const isParallel = spouse.gender === sibling.gender;
        const isTargetMale = target.gender === 'male';

        if (isParallel) {
            return isTargetMale ? 'Son (Koduku)' : 'Daughter (Kuthuru)';
        } else {
            return isTargetMale ? 'Nephew (Menalludu)' : 'Niece (Menakodalu)';
        }
    }

    // Fallback: Just join types
    const simpleTypes = steps.slice(1).map(s => s.relType);
    return simpleTypes.join(' -> ');
}
