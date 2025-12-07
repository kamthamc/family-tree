import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Person } from '../api';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import EditPersonModal from '../components/EditPersonModal';

export default function PeopleList() {
    const queryClient = useQueryClient();
    const { data: people, isLoading } = useQuery({ queryKey: ['people'], queryFn: api.getPeople });
    const [isAdding, setIsAdding] = useState(false);
    const [newPersonName, setNewPersonName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const [editingPerson, setEditingPerson] = useState<Person | null>(null);

    const createMutation = useMutation({
        mutationFn: api.createPerson,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['people'] });
            setIsAdding(false);
            setNewPersonName('');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: api.deletePerson,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['people'] });
        },
    });

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        const [first, ...last] = newPersonName.split(' ');
        createMutation.mutate({ firstName: first, lastName: last.join(' ') || null, gender: 'unknown' });
    };

    const filteredPeople = people?.filter(p =>
    (p.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.nickname?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (isLoading) return <div className="p-8 text-white">Loading...</div>;

    return (
        <div className="p-8 h-full overflow-auto bg-gray-900 text-white">
            {editingPerson && (
                <EditPersonModal person={editingPerson} onClose={() => setEditingPerson(null)} />
            )}
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold">People Directory</h1>
                <div className="flex gap-4 w-full md:w-auto">
                    <input
                        type="text"
                        placeholder="Search people..."
                        className="bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-blue-500 outline-none w-full md:w-64"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button
                        onClick={() => setIsAdding(true)}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap"
                    >
                        <Plus size={20} /> Add Person
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {isAdding && (
                    <motion.form
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        onSubmit={handleAdd}
                        className="mb-8 bg-gray-800 p-6 rounded-xl border border-gray-700 flex gap-4 items-center shadow-lg"
                    >
                        <input
                            autoFocus
                            type="text"
                            placeholder="Full Name"
                            className="flex-1 bg-gray-900 text-white px-4 py-3 rounded-lg border border-gray-700 focus:border-blue-500 outline-none"
                            value={newPersonName}
                            onChange={(e) => setNewPersonName(e.target.value)}
                        />
                        <button type="submit" className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-lg font-medium">
                            Save
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsAdding(false)}
                            className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium"
                        >
                            Cancel
                        </button>
                    </motion.form>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                <AnimatePresence>
                    {filteredPeople?.map((person) => (
                        <motion.div
                            key={person.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            layout
                            className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-blue-500/50 transition-colors shadow-lg group"
                        >
                            <div className="p-6 flex flex-col items-center text-center">
                                <div className="w-24 h-24 rounded-full bg-gray-700 mb-4 overflow-hidden border-4 border-gray-800 shadow-sm relative group-hover:scale-105 transition-transform">
                                    {person.profileImage ? (
                                        <img src={person.profileImage} alt={person.firstName || ''} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-500 text-2xl font-bold">
                                            {person.firstName?.[0]}{person.lastName?.[0]}
                                        </div>
                                    )}
                                </div>
                                <h3 className="text-xl font-bold text-white mb-1 truncate w-full">
                                    {person.firstName} {person.lastName}
                                </h3>
                                {person.nickname && <div className="text-blue-400 text-sm mb-2 italic">"{person.nickname}"</div>}
                                <div className="text-gray-400 text-sm mb-4">
                                    {person.birthDate ? new Date(person.birthDate).getFullYear() : '?'}
                                    {person.deathDate ? ` - ${new Date(person.deathDate).getFullYear()}` : ''}
                                </div>

                                <div className="flex gap-2 w-full mt-auto pt-4 border-t border-gray-700/50">
                                    <button
                                        onClick={() => setEditingPerson(person)}
                                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded text-sm font-medium transition-colors"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => deleteMutation.mutate(person.id)}
                                        className="px-3 text-gray-500 hover:text-red-400 transition-colors"
                                        title="Delete Person"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
            {filteredPeople?.length === 0 && (
                <div className="text-center text-gray-500 mt-20 text-lg">
                    {searchTerm ? 'No people found matching your search.' : 'No people found. Add someone to get started.'}
                </div>
            )}
        </div>
    );
}
