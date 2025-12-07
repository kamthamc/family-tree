import { useState, useMemo } from 'react';
import { Search, Calendar, ChevronRight, ChevronLeft, User, UserCircle, UserCircle2, HelpCircle } from 'lucide-react';
import { useReactFlow } from '@xyflow/react';
import { type Person } from '../../api';

interface DashboardProps {
    people?: Person[];
    onNodeSelect?: (nodeId: string) => void;
}

export default function Dashboard({ people = [], onNodeSelect }: DashboardProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const reactFlow = useReactFlow();

    const filteredPeople = useMemo(() => {
        if (!searchTerm) return [];
        const lower = searchTerm.toLowerCase();
        return people.filter(p =>
        (p.firstName?.toLowerCase().includes(lower) ||
            p.lastName?.toLowerCase().includes(lower) ||
            p.nickname?.toLowerCase().includes(lower))
        ).slice(0, 10); // Increased limit for better visibility
    }, [people, searchTerm]);

    const upcomingBirthdays = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth(); // 0-11 (0 = January, 11 = December)

        return people.filter(p => {
            if (!p.birthDate) return false;
            // Parse the birth date
            const birthDate = new Date(p.birthDate);
            // Get the month from the birth date (0-11)
            const birthMonth = birthDate.getUTCMonth();

            return birthMonth === currentMonth;
        }).sort((a, b) => {
            const dateA = new Date(a.birthDate!).getUTCDate();
            const dateB = new Date(b.birthDate!).getUTCDate();
            return dateA - dateB;
        });
    }, [people]);

    const handlePersonClick = (personId: string) => {
        if (onNodeSelect) {
            onNodeSelect(personId);
        } else {
            // Center on person
            reactFlow.fitView({ nodes: [{ id: personId }], duration: 800, padding: 0.5 });
        }
    };

    const getGenderIcon = (gender: string | null) => {
        if (gender === 'male') return <UserCircle size={16} color="#60a5fa" />;
        if (gender === 'female') return <UserCircle2 size={16} color="#ec4899" />;
        return <HelpCircle size={16} color="#9ca3af" />;
    };

    return (
        <div className={`absolute top-4 left-4 z-20 flex transition-all duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-[calc(100%-2rem)]'}`}>
            <div className={`bg-gray-800 rounded-lg shadow-xl border border-gray-700 w-80 flex flex-col overflow-hidden transition-all duration-300`}>
                {/* Header / Toggle */}
                <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900">
                    <h2 className="font-bold text-lg text-white flex items-center gap-2">
                        <User size={20} className="text-blue-400" /> Family Dashboard
                    </h2>
                    <button onClick={() => setIsOpen(!isOpen)} className="text-gray-400 hover:text-white">
                        {isOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
                    </button>
                </div>

                {isOpen && (
                    <div className="flex-1 overflow-y-auto max-h-[80vh] p-4 space-y-6">
                        {/* Search Section */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Search Person</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search by name..."
                                    className="w-full bg-gray-700 text-white rounded-lg pl-9 pr-3 py-2 border border-gray-600 focus:border-blue-500 outline-none placeholder-gray-500"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                {filteredPeople.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-gray-700 rounded-lg shadow-lg border border-gray-600 overflow-hidden z-30">
                                        {filteredPeople.map(person => (
                                            <button
                                                key={person.id}
                                                onClick={() => {
                                                    handlePersonClick(person.id);
                                                    setSearchTerm('');
                                                }}
                                                className="w-full text-left px-3 py-2 hover:bg-gray-600 flex items-center gap-2"
                                            >
                                                {getGenderIcon(person.gender)}
                                                <span className="truncate text-sm">{person.firstName} {person.lastName}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Birthdays Section */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                <Calendar size={14} /> Birthdays this Month
                            </label>
                            {upcomingBirthdays.length > 0 ? (
                                <div className="space-y-2">
                                    {upcomingBirthdays.map(person => {
                                        const date = new Date(person.birthDate!);
                                        const isToday = date.getDate() === new Date().getDate();
                                        return (
                                            <button
                                                key={person.id}
                                                onClick={() => handlePersonClick(person.id)}
                                                className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors border ${isToday
                                                    ? 'bg-blue-900/30 border-blue-500/50 hover:bg-blue-900/50'
                                                    : 'bg-gray-700/50 border-transparent hover:bg-gray-700'
                                                    }`}
                                            >
                                                <div className="text-center min-w-[3rem] bg-gray-800 rounded p-1 border border-gray-600">
                                                    <div className="text-[10px] text-gray-400 uppercase">{date.toLocaleString('default', { month: 'short' })}</div>
                                                    <div className="font-bold text-lg leading-none">{date.getDate()}</div>
                                                </div>
                                                <div className="text-left min-w-0">
                                                    <div className="font-medium truncate text-sm">{person.firstName} {person.lastName}</div>
                                                    {isToday && <div className="text-xs text-blue-400 font-bold">Today! 🎂</div>}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-sm text-gray-500 italic text-center py-4 bg-gray-700/30 rounded-lg">
                                    No birthdays this month.
                                </div>
                            )}
                        </div>

                        {/* Stats Section */}
                        <div className="pt-4 border-t border-gray-700 grid grid-cols-2 gap-2 text-center">
                            <div className="bg-gray-700/30 p-2 rounded">
                                <div className="text-xl font-bold text-white">{people.length}</div>
                                <div className="text-xs text-gray-400">People</div>
                            </div>
                            {/* Assuming families count or other stats can be added here later */}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
