const API_URL = 'http://localhost:3000/api';

export interface PersonAttributes {
    title?: string;
    suffix?: string;
    occupation?: string;
    education?: string;
    religion?: string;
    nationality?: string;
    labels?: string[];
    [key: string]: any; // Allow future extensibility
}

export interface Person {
    id: string;
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
    fromPersonId: string;
    toPersonId: string;
    type: string;
}

export const api = {
    getPeople: async (): Promise<Person[]> => {
        const res = await fetch(`${API_URL}/people`);
        return res.json();
    },
    createPerson: async (person: Partial<Person>): Promise<Person> => {
        const res = await fetch(`${API_URL}/people`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(person),
        });
        return res.json();
    },
    updatePerson: async (id: string, person: Partial<Person>): Promise<Person> => {
        const res = await fetch(`${API_URL}/people/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(person),
        });
        return res.json();
    },
    deletePerson: async (id: string): Promise<void> => {
        await fetch(`${API_URL}/people/${id}`, { method: 'DELETE' });
    },
    getRelationships: async (): Promise<Relationship[]> => {
        const res = await fetch(`${API_URL}/relationships`);
        return res.json();
    },
    createRelationship: async (rel: Partial<Relationship>): Promise<Relationship> => {
        const res = await fetch(`${API_URL}/relationships`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rel),
        });
        return res.json();
    },
    deleteRelationship: async (id: string): Promise<void> => {
        await fetch(`${API_URL}/relationships/${id}`, { method: 'DELETE' });
    },
    updateRelationship: async (id: string, type: string): Promise<void> => {
        await fetch(`${API_URL}/relationships/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type }),
        });
    },
    importData: async (data: { people: Person[]; relationships: Relationship[] }): Promise<void> => {
        await fetch(`${API_URL}/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
    },
    getEvents: async (personId: string): Promise<Event[]> => {
        const res = await fetch(`${API_URL}/events/person/${personId}`);
        return res.json();
    },
    createEvent: async (event: Partial<Event>): Promise<Event> => {
        const res = await fetch(`${API_URL}/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event),
        });
        return res.json();
    },
    deleteEvent: async (id: string): Promise<void> => {
        await fetch(`${API_URL}/events/${id}`, { method: 'DELETE' });
    },
};
