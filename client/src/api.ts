const API_URL = import.meta.env.VITE_API_URL || '/api';

export interface PersonAttributes {
    title?: string;
    suffix?: string;
    occupation?: string;
    education?: string;
    religion?: string;
    nationality?: string;
    labels?: string[];
    [key: string]: any;
}

export interface Person {
    id: string;
    familyTreeId?: string;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
    nickname: string | null;
    gender: string | null;
    birthDate: string | null;
    deathDate: string | null;
    notes: string | null;
    profileImage: string | null;
    attributes: PersonAttributes;
}

export interface Event {
    id: string;
    personId: string;
    type: string;
    date: string | null;
    place: string | null;
    description: string | null;
}

export interface Relationship {
    id: string;
    familyTreeId?: string;
    fromPersonId: string;
    toPersonId: string;
    type: string;
}

export interface FamilyTree {
    id: string;
    name: string;
    description: string | null;
    role?: string; // from permission
}

// Helper to get headers
const getHeaders = () => {
    const token = localStorage.getItem('accessToken');
    const userKey = localStorage.getItem('userKey'); // Store in sessionStorage/localStorage

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    if (userKey) {
        headers['X-User-Key'] = userKey;
    }

    return headers;
};

// Helper to get current family tree
const getFamilyTreeId = () => {
    return localStorage.getItem('currentFamilyTreeId');
};

export const api = {
    // Auth
    register: async (data: any) => {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        return res.json();
    },
    login: async (data: any) => {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        return res.json();
    },
    getMe: async () => {
        const res = await fetch(`${API_URL}/auth/me`, {
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Failed to fetch user');
        return res.json();
    },

    // Family Trees
    getFamilyTrees: async (): Promise<{ owned: FamilyTree[], shared: FamilyTree[] }> => {
        const res = await fetch(`${API_URL}/family-trees`, {
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Failed to fetch trees');
        return res.json();
    },
    createFamilyTree: async (data: { name: string, description?: string }) => {
        const res = await fetch(`${API_URL}/family-trees`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to create tree');
        return res.json();
    },
    duplicateFamilyTree: async (treeId: string) => {
        const res = await fetch(`${API_URL}/family-trees/${treeId}/duplicate`, {
            method: 'POST',
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Failed to duplicate tree');
        return res.json();
    },
    deleteFamilyTree: async (treeId: string) => {
        const res = await fetch(`${API_URL}/family-trees/${treeId}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Failed to delete tree');
        return res.json();
    },

    // People
    getPeople: async (): Promise<Person[]> => {
        const treeId = getFamilyTreeId();
        if (!treeId) return []; // Or throw error

        const res = await fetch(`${API_URL}/people?familyTreeId=${treeId}`, {
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Failed to fetch people');
        return res.json();
    },
    createPerson: async (person: Partial<Person>): Promise<Person> => {
        const treeId = getFamilyTreeId();
        if (!treeId) throw new Error('No family tree selected');

        const res = await fetch(`${API_URL}/people`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ ...person, familyTreeId: treeId }),
        });
        if (!res.ok) throw new Error('Failed to create person');
        return res.json();
    },
    updatePerson: async (id: string, person: Partial<Person>): Promise<Person> => {
        const res = await fetch(`${API_URL}/people/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(person),
        });
        if (!res.ok) throw new Error('Failed to update person');
        return res.json();
    },
    deletePerson: async (id: string): Promise<void> => {
        const res = await fetch(`${API_URL}/people/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete person');
    },

    // Relationships
    getRelationships: async (): Promise<Relationship[]> => {
        const treeId = getFamilyTreeId();
        if (!treeId) return [];

        const res = await fetch(`${API_URL}/relationships?familyTreeId=${treeId}`, {
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Failed to fetch relationships');
        return res.json();
    },
    createRelationship: async (rel: Partial<Relationship>): Promise<Relationship> => {
        const treeId = getFamilyTreeId();
        if (!treeId) throw new Error('No family tree selected');

        const res = await fetch(`${API_URL}/relationships`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ ...rel, familyTreeId: treeId }),
        });
        if (!res.ok) throw new Error('Failed to create relationship');
        return res.json();
    },
    deleteRelationship: async (id: string): Promise<void> => {
        const res = await fetch(`${API_URL}/relationships/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete relationship');
    },
    updateRelationship: async (id: string, type: string): Promise<void> => {
        const res = await fetch(`${API_URL}/relationships/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ type }),
        });
        if (!res.ok) throw new Error('Failed to update relationship');
    },

    // Events
    getEvents: async (personId: string): Promise<Event[]> => {
        const res = await fetch(`${API_URL}/events/person/${personId}`, {
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch events');
        return res.json();
    },
    createEvent: async (event: Partial<Event>): Promise<Event> => {
        const res = await fetch(`${API_URL}/events`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(event),
        });
        if (!res.ok) throw new Error('Failed to create event');
        return res.json();
    },
    deleteEvent: async (id: string): Promise<void> => {
        const res = await fetch(`${API_URL}/events/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete event');
    },

    // Import - needs update to handle familyTreeId
    importData: async (data: { people: Person[]; relationships: Relationship[] }): Promise<void> => {
        const treeId = getFamilyTreeId();
        if (!treeId) throw new Error('No family tree selected');

        // This endpoint needs to be updated on server too to accept familyTreeId
        const res = await fetch(`${API_URL}/import`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ ...data, familyTreeId: treeId }),
        });
        if (!res.ok) throw new Error('Failed to import data');
    },
};
