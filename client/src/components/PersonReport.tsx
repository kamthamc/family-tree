
import { type Person, api } from '../api';
import { useQuery } from '@tanstack/react-query';
import { X, Printer, Calendar, MapPin } from 'lucide-react';

interface PersonReportProps {
    person: Person;
    onClose: () => void;
}

export default function PersonReport({ person, onClose }: PersonReportProps) {
    const { data: events } = useQuery({
        queryKey: ['events', person.id],
        queryFn: () => api.getEvents(person.id)
    });

    // We fetch relationships to show family summary
    const { data: allRelationships } = useQuery({ queryKey: ['relationships'], queryFn: api.getRelationships });
    const { data: allPeople } = useQuery({ queryKey: ['people'], queryFn: api.getPeople });

    const handlePrint = () => {
        window.print();
    };

    const getFamilyMembers = (type: string) => {
        if (!allRelationships || !allPeople) return [];
        const rels = allRelationships.filter(r =>
            (r.fromPersonId === person.id || r.toPersonId === person.id) && r.type === type
        );

        return rels.map(r => {
            const id = r.fromPersonId === person.id ? r.toPersonId : r.fromPersonId;
            return allPeople.find(p => p.id === id);
        }).filter(Boolean) as Person[];
    };

    const parents = allRelationships && allPeople ? allRelationships.filter(r => r.toPersonId === person.id && r.type === 'parent').map(r => allPeople.find(p => p.id === r.fromPersonId)).filter(Boolean) as Person[] : [];
    const children = allRelationships && allPeople ? allRelationships.filter(r => r.fromPersonId === person.id && r.type === 'parent').map(r => allPeople.find(p => p.id === r.toPersonId)).filter(Boolean) as Person[] : [];
    const spouses = getFamilyMembers('spouse').concat(getFamilyMembers('divorced'));

    return (
        <div className="fixed inset-0 bg-white z-[100] overflow-y-auto text-black">
            {/* No-Print Header */}
            <div className="fixed top-0 left-0 right-0 bg-gray-900 text-white p-4 flex justify-between items-center print:hidden shadow-lg">
                <h2 className="text-xl font-bold">Person Report: {person.firstName} {person.lastName}</h2>
                <div className="flex gap-2">
                    <button
                        onClick={handlePrint}
                        className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded flex items-center gap-2"
                    >
                        <Printer size={18} /> Print
                    </button>
                    <button
                        onClick={onClose}
                        className="bg-gray-700 hover:bg-gray-600 p-2 rounded"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Printable Content */}
            <div className="max-w-4xl mx-auto mt-20 p-8 print:mt-0 print:p-0">

                {/* Header Section */}
                <div className="flex gap-8 mb-8 border-b-2 border-gray-800 pb-8">
                    <div className="w-48 h-48 bg-gray-200 rounded-lg overflow-hidden border border-gray-300 flex-shrink-0">
                        {person.profileImage ? (
                            <img src={person.profileImage} alt={person.firstName || ''} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl">?</div>
                        )}
                    </div>
                    <div className="flex-1">
                        <h1 className="text-4xl font-bold mb-2">
                            {person.attributes?.title && <span className="text-gray-600 text-2xl mr-2">{person.attributes.title}</span>}
                            {person.firstName} {person.middleName} {person.lastName}
                            {person.attributes?.suffix && <span className="text-gray-600 text-xl ml-2">{person.attributes.suffix}</span>}
                        </h1>
                        <p className="text-xl text-gray-600 mb-4">{person.nickname && `"${person.nickname}"`}</p>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex gap-2">
                                <span className="font-bold w-20">Born:</span>
                                <div>
                                    {person.birthDate || 'Unknown'} <br />
                                    {/* Place if available in birth event */}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <span className="font-bold w-20">Died:</span>
                                <div>{person.deathDate || (person.birthDate ? 'Living' : 'Unknown')}</div>
                            </div>
                            <div className="flex gap-2">
                                <span className="font-bold w-20">Gender:</span>
                                <div>{person.gender || 'Unknown'}</div>
                            </div>
                            <div className="flex gap-2">
                                <span className="font-bold w-20">Nationality:</span>
                                <div>{person.attributes?.nationality || '-'}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Attributes Section */}
                <div className="mb-8 grid grid-cols-2 gap-8">
                    <div>
                        <h3 className="text-xl font-bold border-b border-gray-300 mb-4 pb-2">Facts</h3>
                        <dl className="grid grid-cols-[100px_1fr] gap-y-2">
                            <dt className="font-semibold text-gray-600">Occupation</dt>
                            <dd>{person.attributes?.occupation || '-'}</dd>
                            <dt className="font-semibold text-gray-600">Education</dt>
                            <dd>{person.attributes?.education || '-'}</dd>
                            <dt className="font-semibold text-gray-600">Religion</dt>
                            <dd>{person.attributes?.religion || '-'}</dd>
                        </dl>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold border-b border-gray-300 mb-4 pb-2">Note</h3>
                        <p className="text-gray-700 whitespace-pre-wrap">{person.notes || 'No notes available.'}</p>
                    </div>
                </div>

                {/* Family Section */}
                <div className="mb-8">
                    <h3 className="text-xl font-bold border-b border-gray-300 mb-4 pb-2">Family Members</h3>
                    <div className="grid grid-cols-3 gap-8">
                        <div>
                            <h4 className="font-bold text-gray-600 mb-2">Parents</h4>
                            <ul className="list-disc pl-4 space-y-1">
                                {parents.length > 0 ? parents.map(p => (
                                    <li key={p.id}>{p.firstName} {p.lastName}</li>
                                )) : <li className="text-gray-400 italic">None recorded</li>}
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-600 mb-2">Spouse(s)</h4>
                            <ul className="list-disc pl-4 space-y-1">
                                {spouses.length > 0 ? spouses.map(p => (
                                    <li key={p.id}>{p.firstName} {p.lastName}</li>
                                )) : <li className="text-gray-400 italic">None recorded</li>}
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-600 mb-2">Children</h4>
                            <ul className="list-disc pl-4 space-y-1">
                                {children.length > 0 ? children.map(p => (
                                    <li key={p.id}>{p.firstName} {p.lastName}</li>
                                )) : <li className="text-gray-400 italic">None recorded</li>}
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Timeline Section */}
                <div className="mb-8">
                    <h3 className="text-xl font-bold border-b border-gray-300 mb-4 pb-2">Life Timeline</h3>
                    <div className="space-y-4">
                        {events && events.length > 0 ? events.sort((a, b) => (a.date || '').localeCompare(b.date || '')).map((ev) => (
                            <div key={ev.id} className="flex gap-4">
                                <div className="w-32 font-mono text-sm text-gray-600 flex-shrink-0 flex items-center gap-2">
                                    <Calendar size={14} />
                                    {ev.date || 'Unknown Date'}
                                </div>
                                <div>
                                    <div className="font-bold">{ev.type}</div>
                                    <div className="text-sm text-gray-700">{ev.description}</div>
                                    {ev.place && (
                                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                            <MapPin size={12} /> {ev.place}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )) : (
                            <div className="text-gray-400 italic">No events recorded.</div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
