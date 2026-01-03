import type { Relationship } from '../api';

export function getLineage(rootId: string, relationships: Relationship[]) {
    const includedIds = new Set<string>();
    includedIds.add(rootId);

    // Helper maps
    const parentMap = new Map<string, string[]>(); // child -> parents
    const childMap = new Map<string, string[]>();  // parent -> children
    const spouseMap = new Map<string, string[]>(); // person -> spouses

    relationships.forEach(rel => {
        if (rel.type === 'parent') {
            if (!parentMap.has(rel.toPersonId)) parentMap.set(rel.toPersonId, []);
            parentMap.get(rel.toPersonId)!.push(rel.fromPersonId);

            if (!childMap.has(rel.fromPersonId)) childMap.set(rel.fromPersonId, []);
            childMap.get(rel.fromPersonId)!.push(rel.toPersonId);
        } else if (rel.type === 'spouse') {
            if (!spouseMap.has(rel.fromPersonId)) spouseMap.set(rel.fromPersonId, []);
            spouseMap.get(rel.fromPersonId)!.push(rel.toPersonId);

            if (!spouseMap.has(rel.toPersonId)) spouseMap.set(rel.toPersonId, []);
            spouseMap.get(rel.toPersonId)!.push(rel.fromPersonId);
        }
    });

    // 1. Ancestors (Walk Up)
    let queue = [rootId];
    while (queue.length > 0) {
        const current = queue.shift()!;
        const parents = parentMap.get(current) || [];
        parents.forEach(p => {
            if (!includedIds.has(p)) {
                includedIds.add(p);
                queue.push(p);
            }
        });
    }

    // 2. Descendants (Walk Down)
    queue = [rootId];
    while (queue.length > 0) {
        const current = queue.shift()!;
        const children = childMap.get(current) || [];
        children.forEach(c => {
            if (!includedIds.has(c)) {
                includedIds.add(c);
                queue.push(c);
            }
        });
    }

    // 3. Spouses of everyone found so far
    // (We iterate a copy of the Set because we shouldn't add infinite spouse chains, just immediate spouses of lineage)
    const bloodline = Array.from(includedIds);
    bloodline.forEach(id => {
        const spouses = spouseMap.get(id) || [];
        spouses.forEach(s => includedIds.add(s));
    });

    return includedIds;
}
