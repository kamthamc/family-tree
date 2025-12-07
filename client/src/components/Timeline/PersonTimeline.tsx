import { type Person, type Event } from '../../api';

interface PersonTimelineProps {
    person: Person;
    events: Event[];
}

export default function PersonTimeline({ person, events }: PersonTimelineProps) {
    const allEvents = [
        ...(person.birthDate ? [{
            id: 'birth',
            type: 'birth',
            date: person.birthDate,
            place: 'Birthplace', // We don't have birth place in person model directly, maybe in future
            description: `Born as ${person.firstName} ${person.lastName}`
        }] : []),
        ...events,
        ...(person.deathDate ? [{
            id: 'death',
            type: 'death',
            date: person.deathDate,
            place: 'Place of Death',
            description: `Died at age ${calculateAge(person.birthDate, person.deathDate)}`
        }] : [])
    ].sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return da - db;
    });

    return (
        <div className="relative border-l-2 border-gray-600 ml-4 py-4 space-y-8">
            {allEvents.map((event, index) => (
                <div key={event.id || index} className="relative pl-6">
                    <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 ${event.type === 'birth' ? 'bg-green-500 border-green-300' :
                            event.type === 'death' ? 'bg-gray-500 border-gray-300' :
                                'bg-blue-500 border-blue-300'
                        }`} />
                    <div className="bg-gray-700/50 p-3 rounded-lg border border-gray-600">
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">{event.date}</div>
                        <h3 className="font-bold text-lg capitalize text-white">{event.type}</h3>
                        {event.place && <div className="text-sm text-gray-300 flex gap-1">📍 {event.place}</div>}
                        {event.description && <div className="text-sm italic text-gray-400 mt-1">"{event.description}"</div>}
                    </div>
                </div>
            ))}
            {allEvents.length === 0 && (
                <div className="pl-6 text-gray-500 italic">No timeline events recorded.</div>
            )}
        </div>
    );
}

function calculateAge(birth: string | null | undefined, death: string | null | undefined) {
    if (!birth || !death) return '?';
    const b = new Date(birth);
    const d = new Date(death);
    let age = d.getFullYear() - b.getFullYear();
    const m = d.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && d.getDate() < b.getDate())) {
        age--;
    }
    return age;
}
