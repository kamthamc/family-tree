import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Upload, Plus, Trash2, Tag, Printer } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PersonTimeline from './Timeline/PersonTimeline';
import { api, type Person, type Event, type PersonAttributes } from '../api';
import PersonReport from './PersonReport';
import SearchablePersonSelect from './SearchablePersonSelect';

interface EditPersonModalProps {
    person: Person;
    onClose: () => void;
    onFocus?: (personId: string, mode: 'ancestors' | 'descendants' | 'all') => void;
}

export default function EditPersonModal({ person, onClose, onFocus }: EditPersonModalProps) {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'details' | 'family' | 'events' | 'timeline'>('details');
    // Ensure attributes object exists
    const [formData, setFormData] = useState<Partial<Person>>({
        ...person,
        attributes: person.attributes || {}
    });

    const { data: events } = useQuery({ queryKey: ['events', person.id], queryFn: () => api.getEvents(person.id) });
    const { data: people } = useQuery({ queryKey: ['people'], queryFn: api.getPeople });
    const { data: relationships } = useQuery({ queryKey: ['relationships'], queryFn: api.getRelationships });

    const createRelationshipMutation = useMutation({
        mutationFn: api.createRelationship,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['relationships'] }),
    });

    const deleteRelationshipMutation = useMutation({
        mutationFn: api.deleteRelationship,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['relationships'] }),
    });

    const updateRelationshipMutation = useMutation({
        mutationFn: ({ id, type }: { id: string, type: string }) => api.updateRelationship(id, type),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['relationships'] }),
    });

    // Helper to get family members
    const parents = relationships?.filter(r => r.toPersonId === person.id && r.type === 'parent').map(r => {
        const p = people?.find(p => p.id === r.fromPersonId);
        return { ...r, person: p };
    }) || [];

    const children = relationships?.filter(r => r.fromPersonId === person.id && r.type === 'parent').map(r => {
        const p = people?.find(p => p.id === r.toPersonId);
        return { ...r, person: p };
    }) || [];

    const spouses = relationships?.filter(r => (r.fromPersonId === person.id || r.toPersonId === person.id) && (r.type === 'spouse' || r.type === 'divorced')).map(r => {
        const partnerId = r.fromPersonId === person.id ? r.toPersonId : r.fromPersonId;
        const p = people?.find(p => p.id === partnerId);
        return { ...r, person: p };
    }) || [];

    const [selectedRelationId, setSelectedRelationId] = useState('');

    const handleAddParent = () => {
        if (!selectedRelationId) return;
        createRelationshipMutation.mutate({ fromPersonId: selectedRelationId, toPersonId: person.id, type: 'parent' });
        setSelectedRelationId('');
    };

    const handleAddChild = () => {
        if (!selectedRelationId) return;
        createRelationshipMutation.mutate({ fromPersonId: person.id, toPersonId: selectedRelationId, type: 'parent' });
        setSelectedRelationId('');
    };

    const handleAddSpouse = () => {
        if (!selectedRelationId) return;
        createRelationshipMutation.mutate({ fromPersonId: person.id, toPersonId: selectedRelationId, type: 'spouse' });
        setSelectedRelationId('');
    };


    const updateMutation = useMutation({
        mutationFn: (data: Partial<Person>) => api.updatePerson(person.id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['people'] });
            onClose();
        },
    });

    const createEventMutation = useMutation({
        mutationFn: api.createEvent,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events', person.id] }),
    });

    const deleteEventMutation = useMutation({
        mutationFn: api.deleteEvent,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events', person.id] }),
    });

    const handleSave = () => {
        updateMutation.mutate(formData);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData({ ...formData, profileImage: reader.result as string });
            };
            reader.readAsDataURL(file);
        }
    };

    const updateAttribute = (key: keyof PersonAttributes, value: any) => {
        setFormData(prev => ({
            ...prev,
            attributes: {
                ...prev.attributes,
                [key]: value
            }
        }));
    };

    // Label/Tag Logic
    const [newLabel, setNewLabel] = useState('');
    const handleAddLabel = () => {
        if (!newLabel.trim()) return;
        const currentLabels = formData.attributes?.labels || [];
        if (!currentLabels.includes(newLabel.trim())) {
            updateAttribute('labels', [...currentLabels, newLabel.trim()]);
        }
        setNewLabel('');
    };

    const removeLabel = (labelToRemove: string) => {
        const currentLabels = formData.attributes?.labels || [];
        updateAttribute('labels', currentLabels.filter(l => l !== labelToRemove));
    };

    const [newEvent, setNewEvent] = useState<Partial<Event> & { partnerId?: string }>({ type: 'birth', date: '', place: '', description: '' });

    const [error, setError] = useState<string | null>(null);
    const [showReport, setShowReport] = useState(false);

    const handleAddEvent = () => {
        setError(null);
        if ((newEvent.type === 'birth' || newEvent.type === 'death') && events?.some(e => e.type === newEvent.type)) {
            setError(`A ${newEvent.type} event already exists for this person.`);
            return;
        }

        // Ensure strictly relevant properties are passed to the API
        const { partnerId, ...eventData } = newEvent;
        createEventMutation.mutate({ ...eventData, personId: person.id });

        // Auto-create spouse relationship if marriage and partner selected
        if (newEvent.type === 'marriage' && partnerId) {
            // Check if relationship already exists
            const existing = relationships?.find(r =>
                (r.fromPersonId === person.id && r.toPersonId === partnerId && r.type === 'spouse') ||
                (r.fromPersonId === partnerId && r.toPersonId === person.id && r.type === 'spouse')
            );

            if (!existing) {
                createRelationshipMutation.mutate({ fromPersonId: person.id, toPersonId: partnerId, type: 'spouse' });
            }
        }

        setNewEvent({ type: 'birth', date: '', place: '', description: '' });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-800"
            >
                {/* Header */}
                <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden border border-gray-600">
                            {formData.profileImage ? (
                                <img src={formData.profileImage} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-500">No Img</div>
                            )}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">{formData.firstName} {formData.lastName}</h2>
                            <p className="text-xs text-gray-400 uppercase tracking-wider">{activeTab}</p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        {onFocus && (
                            <>
                                <button
                                    onClick={() => onFocus(person.id, 'ancestors')}
                                    className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-1.5 rounded text-blue-300 transition-colors"
                                >
                                    Ancestors
                                </button>
                                <button
                                    onClick={() => onFocus(person.id, 'descendants')}
                                    className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-1.5 rounded text-green-300 transition-colors"
                                >
                                    Descendants
                                </button>
                            </>
                        )}
                        <button
                            onClick={() => setShowReport(true)}
                            className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-white p-1 rounded transition-colors"
                            title="Print Person Report"
                        >
                            <Printer size={24} />
                        </button>
                        <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800"><X size={24} /></button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-800 bg-gray-900/50">
                    {['details', 'family', 'events', 'timeline'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`flex-1 py-3 text-sm font-medium capitalize transition-colors relative ${activeTab === tab ? 'text-blue-400' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                                }`}
                        >
                            {tab}
                            {activeTab === tab && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400"
                                />
                            )}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="p-6 overflow-y-auto flex-1 bg-gray-900">
                    {activeTab === 'details' && (
                        <div className="space-y-6">

                            {/* Card: Name & Identity */}
                            <section className="bg-gray-800/50 border border-gray-700 rounded-lg p-5">
                                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4 border-b border-gray-700 pb-2">Name & Identity</h3>
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">

                                    {/* Profile Image Column */}
                                    <div className="md:col-span-3 flex flex-col items-center justify-center border-r border-gray-700/50 pr-4">
                                        <div className="relative w-32 h-32 rounded-full bg-gray-700 overflow-hidden border-4 border-gray-800 shadow-xl mb-3 group">
                                            {formData.profileImage ? (
                                                <img src={formData.profileImage} alt="Profile" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-500">No Img</div>
                                            )}
                                            <label className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                                                <Upload size={24} className="text-white mb-1" />
                                                <span className="text-[10px] text-gray-200 font-medium uppercase">Change</span>
                                                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                            </label>
                                        </div>
                                    </div>

                                    {/* Name Fields Column */}
                                    <div className="md:col-span-9 grid grid-cols-2 lg:grid-cols-3 gap-3">
                                        <Input label="Title" placeholder="Mr., Dr., etc" value={formData.attributes?.title} onChange={(v) => updateAttribute('title', v)} />
                                        <Input label="First Name" value={formData.firstName} onChange={(v) => setFormData({ ...formData, firstName: v })} />
                                        <Input label="Middle Name" value={formData.middleName} onChange={(v) => setFormData({ ...formData, middleName: v })} />
                                        <Input label="Last Name" value={formData.lastName} onChange={(v) => setFormData({ ...formData, lastName: v })} />
                                        <Input label="Suffix" placeholder="Jr., III, etc" value={formData.attributes?.suffix} onChange={(v) => updateAttribute('suffix', v)} />
                                        <Input label="Nickname" value={formData.nickname} onChange={(v) => setFormData({ ...formData, nickname: v })} />

                                        <div className="col-span-1">
                                            <label className="block text-xs font-medium text-gray-400 mb-1">Gender</label>
                                            <select
                                                className="w-full bg-gray-900 rounded border border-gray-700 p-2 text-white text-sm focus:border-blue-500 outline-none hover:border-gray-600 transition-colors"
                                                value={formData.gender || ''}
                                                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                                            >
                                                <option value="">Select Gender</option>
                                                <option value="male">Male</option>
                                                <option value="female">Female</option>
                                                <option value="other">Other</option>
                                            </select>
                                        </div>
                                        <Input label="Birth Date" type="date" value={formData.birthDate} onChange={(v) => setFormData({ ...formData, birthDate: v })} />
                                        <Input label="Death Date" type="date" value={formData.deathDate} onChange={(v) => setFormData({ ...formData, deathDate: v })} />
                                    </div>
                                </div>
                            </section>

                            {/* Card: Facts & Attributes */}
                            <section className="bg-gray-800/50 border border-gray-700 rounded-lg p-5">
                                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4 border-b border-gray-700 pb-2">Facts & Attributes</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input label="Occupation" placeholder="e.g. Engineer" value={formData.attributes?.occupation} onChange={(v) => updateAttribute('occupation', v)} />
                                    <Input label="Education" placeholder="e.g. PhD in Physics" value={formData.attributes?.education} onChange={(v) => updateAttribute('education', v)} />
                                    <Input label="Religion" placeholder="e.g. Christian" value={formData.attributes?.religion} onChange={(v) => updateAttribute('religion', v)} />
                                    <Input label="Nationality" placeholder="e.g. American" value={formData.attributes?.nationality} onChange={(v) => updateAttribute('nationality', v)} />

                                    <div className="col-span-1 md:col-span-2">
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Bio / Notes</label>
                                        <textarea
                                            className="w-full bg-gray-900 rounded border border-gray-700 p-3 text-white text-sm focus:border-blue-500 outline-none hover:border-gray-600 transition-colors resize-y min-h-[80px]"
                                            value={formData.notes || ''}
                                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                            placeholder="Write a brief biography..."
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Card: Labels/Tags */}
                            <section className="bg-gray-800/50 border border-gray-700 rounded-lg p-5">
                                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4 border-b border-gray-700 pb-2 flex items-center gap-2">
                                    <Tag size={16} /> Labels
                                </h3>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {(formData.attributes?.labels || []).map((label, idx) => (
                                        <span key={idx} className="bg-blue-900/30 text-blue-200 border border-blue-800 px-2 py-1 rounded-full text-xs flex items-center gap-1">
                                            {label}
                                            <button onClick={() => removeLabel(label)} className="hover:text-white"><X size={12} /></button>
                                        </span>
                                    ))}
                                    {(formData.attributes?.labels || []).length === 0 && (
                                        <span className="text-gray-500 text-sm italic">No labels added.</span>
                                    )}
                                </div>
                                <div className="flex gap-2 max-w-sm">
                                    <input
                                        type="text"
                                        className="flex-1 bg-gray-900 rounded border border-gray-700 p-2 text-white text-sm outline-none focus:border-blue-500"
                                        placeholder="Add label..."
                                        value={newLabel}
                                        onChange={(e) => setNewLabel(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddLabel()}
                                    />
                                    <button onClick={handleAddLabel} className="bg-gray-700 hover:bg-gray-600 px-3 rounded text-white"><Plus size={16} /></button>
                                </div>
                            </section>

                        </div>
                    )}

                    {activeTab === 'family' && (
                        <div className="space-y-6">
                            {/* Parents */}
                            <FamilySection title="Parents" icon="users">
                                <div className="space-y-2 mb-3">
                                    {parents.map((rel) => (
                                        <FamilyMemberRow key={rel.id} person={rel.person} relationType={rel.type} onDelete={() => deleteRelationshipMutation.mutate(rel.id)} />
                                    ))}
                                    {parents.length === 0 && <EmptyState text="No parents recorded" />}
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <SearchablePersonSelect
                                            people={people?.filter(p => p.id !== person.id && !parents.find(parent => parent.person?.id === p.id)) || []}
                                            value={selectedRelationId}
                                            onChange={setSelectedRelationId}
                                            placeholder="Select parent to add..."
                                        />
                                    </div>
                                    <button onClick={handleAddParent} className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-sm self-end"><Plus size={16} /></button>
                                </div>
                            </FamilySection>

                            {/* Spouses */}
                            <FamilySection title="Spouses" icon="heart">
                                <div className="space-y-2 mb-3">
                                    {spouses.map((rel) => (
                                        <FamilyMemberRow
                                            key={rel.id}
                                            person={rel.person}
                                            relationType={rel.type}
                                            onDelete={() => deleteRelationshipMutation.mutate(rel.id)}
                                            onUpdate={(newType) => updateRelationshipMutation.mutate({ id: rel.id, type: newType })}
                                        />
                                    ))}
                                    {spouses.length === 0 && <EmptyState text="No spouses recorded" />}
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <SearchablePersonSelect
                                            people={people?.filter(p => p.id !== person.id && !spouses.find(spouse => spouse.person?.id === p.id)) || []}
                                            value={selectedRelationId}
                                            onChange={setSelectedRelationId}
                                            placeholder="Select spouse to add..."
                                        />
                                    </div>
                                    <button onClick={handleAddSpouse} className="bg-pink-600 hover:bg-pink-500 px-3 py-1 rounded text-sm self-end"><Plus size={16} /></button>
                                </div>
                            </FamilySection>

                            {/* Children */}
                            <FamilySection title="Children" icon="baby">
                                <div className="space-y-2 mb-3">
                                    {children.map((rel) => (
                                        <FamilyMemberRow key={rel.id} person={rel.person} relationType={rel.type} onDelete={() => deleteRelationshipMutation.mutate(rel.id)} />
                                    ))}
                                    {children.length === 0 && <EmptyState text="No children recorded" />}
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <SearchablePersonSelect
                                            people={people?.filter(p => p.id !== person.id && !children.find(child => child.person?.id === p.id)) || []}
                                            value={selectedRelationId}
                                            onChange={setSelectedRelationId}
                                            placeholder="Select child to add..."
                                        />
                                    </div>
                                    <button onClick={handleAddChild} className="bg-green-600 hover:bg-green-500 px-3 py-1 rounded text-sm self-end"><Plus size={16} /></button>
                                </div>
                            </FamilySection>
                        </div>
                    )}

                    {activeTab === 'events' && (
                        <div className="space-y-4">
                            <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                                <h3 className="font-bold mb-3 text-sm uppercase text-blue-400">Add New Event</h3>
                                <div className="grid grid-cols-2 gap-3 mb-2">
                                    <select
                                        className="bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm"
                                        value={newEvent.type}
                                        onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value })}
                                    >
                                        <option value="birth">Birth</option>
                                        <option value="death">Death</option>
                                        <option value="marriage">Marriage</option>
                                        <option value="divorce">Divorce</option>
                                        <option value="graduation">Graduation</option>
                                        <option value="other">Other</option>
                                    </select>
                                    <input
                                        type="date"
                                        className="bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm"
                                        value={newEvent.date || ''}
                                        onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                                    />

                                    {newEvent.type === 'marriage' && (
                                        <div className="col-span-2">
                                            <select
                                                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm"
                                                value={newEvent.partnerId || ''}
                                                onChange={(e) => setNewEvent({ ...newEvent, partnerId: e.target.value })}
                                            >
                                                <option value="">Select Partner (Optional)</option>
                                                {people?.filter(p => p.id !== person.id).map(p => (
                                                    <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                                                ))}
                                            </select>
                                            <div className="text-[10px] text-blue-300 mt-1 italic">
                                                * Selecting a partner creates a Spouse relationship automatically.
                                            </div>
                                        </div>
                                    )}

                                    <input
                                        type="text"
                                        placeholder="Place"
                                        className="bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm col-span-2"
                                        value={newEvent.place || ''}
                                        onChange={(e) => setNewEvent({ ...newEvent, place: e.target.value })}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Description"
                                        className="bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm col-span-2"
                                        value={newEvent.description || ''}
                                        onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                                    />
                                </div>
                                {error && <div className="text-red-400 text-sm mb-2 px-1">{error}</div>}
                                <button onClick={handleAddEvent} className="w-full bg-blue-600 hover:bg-blue-500 py-2 rounded flex items-center justify-center gap-2 text-sm font-medium transition-colors">
                                    <Plus size={16} /> Add Event
                                </button>
                            </div>

                            <div className="space-y-2">
                                {events?.map((event) => (
                                    <div key={event.id} className="bg-gray-800 border border-gray-700 p-3 rounded-lg flex justify-between items-center hover:border-gray-600 transition-colors">
                                        <div>
                                            <div className="font-bold capitalize text-white">{event.type}</div>
                                            <div className="text-xs text-gray-400">{event.date} • {event.place}</div>
                                            {event.description && <div className="text-xs text-gray-500 italic mt-0.5">{event.description}</div>}
                                        </div>
                                        <button onClick={() => deleteEventMutation.mutate(event.id)} className="text-gray-500 hover:text-red-400 transition-colors p-1">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}



                    {activeTab === 'timeline' && (
                        <PersonTimeline person={person} events={events || []} />
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-800 bg-gray-900 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">Cancel</button>
                    <button onClick={handleSave} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium shadow-lg shadow-blue-900/20 text-sm transition-colors">Save Changes</button>
                </div>
            </motion.div>

            {showReport && (
                <PersonReport
                    person={person}
                    onClose={() => setShowReport(false)}
                />
            )}
        </div>
    );
}

// Sub-components for cleaner code
function Input({ label, value, onChange, type = 'text', placeholder }: { label: string, value: string | null | undefined, onChange: (v: string) => void, type?: string, placeholder?: string }) {
    return (
        <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
            <input
                type={type}
                className="w-full bg-gray-900 rounded border border-gray-700 p-2 text-white text-sm focus:border-blue-500 outline-none hover:border-gray-600 transition-colors placeholder-gray-700"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
            />
        </div>
    );
}

function FamilySection({ title, children }: { title: string, children: React.ReactNode, icon?: string }) {
    return (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <h3 className="font-bold text-gray-300 mb-3 border-b border-gray-700 pb-2 text-sm uppercase flex items-center gap-2">
                {title}
            </h3>
            {children}
        </div>
    );
}

function FamilyMemberRow({ person, relationType, onDelete, onUpdate }: { person: Person | undefined, relationType?: string, onDelete: () => void, onUpdate?: (type: string) => void }) {
    const isSpousal = relationType === 'spouse' || relationType === 'divorced';

    return (
        <div className="flex justify-between items-center bg-gray-900 border border-gray-700 p-2.5 rounded group hover:border-gray-600 transition-colors">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-700 overflow-hidden">
                    {person?.profileImage ? <img src={person.profileImage} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[8px] text-gray-500">Img</div>}
                </div>
                <div>
                    <div className="text-sm font-medium text-gray-200">{person?.firstName} {person?.lastName}</div>
                    {isSpousal && onUpdate ? (
                        <select
                            value={relationType}
                            onChange={(e) => onUpdate(e.target.value)}
                            className="bg-gray-800 text-[10px] text-gray-400 border border-gray-700 rounded px-1 py-0.5 mt-0.5 outline-none focus:border-blue-500"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <option value="spouse">Spouse</option>
                            <option value="divorced">Divorced</option>
                        </select>
                    ) : (
                        relationType && relationType !== 'parent' && <div className="text-[10px] text-gray-500 capitalize">{relationType}</div>
                    )}
                </div>
            </div>
            <button onClick={onDelete} className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1">
                <Trash2 size={14} />
            </button>
        </div>
    );
}

function EmptyState({ text }: { text: string }) {
    return <div className="text-gray-600 text-xs italic py-2 text-center border border-dashed border-gray-800 rounded">{text}</div>;
}
