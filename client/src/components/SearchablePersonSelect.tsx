import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, UserCircle, UserCircle2, HelpCircle, ChevronDown } from 'lucide-react';
import type { Person } from '../api';

interface SearchablePersonSelectProps {
    people: Person[];
    value: string;
    onChange: (personId: string) => void;
    label?: string;
    placeholder?: string;
}

export default function SearchablePersonSelect({
    people,
    value,
    onChange,
    label = 'Select Person',
    placeholder = 'Search or select...'
}: SearchablePersonSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    // Sort people by firstName, then lastName
    const sortedPeople = useMemo(() => {
        return [...people].sort((a, b) => {
            const firstNameCompare = (a.firstName || '').localeCompare(b.firstName || '');
            if (firstNameCompare !== 0) return firstNameCompare;
            return (a.lastName || '').localeCompare(b.lastName || '');
        });
    }, [people]);

    // Filter based on search term
    const filteredPeople = useMemo(() => {
        if (!searchTerm) return sortedPeople;
        const lower = searchTerm.toLowerCase();
        return sortedPeople.filter(p =>
            p.firstName?.toLowerCase().includes(lower) ||
            p.lastName?.toLowerCase().includes(lower) ||
            p.nickname?.toLowerCase().includes(lower)
        );
    }, [sortedPeople, searchTerm]);

    const selectedPerson = people.find(p => p.id === value);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    const handleSelect = (personId: string) => {
        onChange(personId);
        setIsOpen(false);
        setSearchTerm('');
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
        setSearchTerm('');
    };

    const getGenderIcon = (gender: string | null) => {
        if (gender === 'male') return <UserCircle size={16} color="#60a5fa" />;
        if (gender === 'female') return <UserCircle2 size={16} color="#ec4899" />;
        return <HelpCircle size={16} color="#9ca3af" />;
    };

    return (
        <div ref={containerRef} className="relative">
            {label && (
                <label className="block text-sm text-gray-400 mb-1">{label}</label>
            )}

            {/* Selected Value Display / Trigger */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-gray-700 rounded p-2 text-white border border-gray-600 focus:border-blue-500 outline-none flex items-center justify-between hover:bg-gray-650 transition-colors"
            >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    {selectedPerson ? (
                        <>
                            {getGenderIcon(selectedPerson.gender)}
                            <span className="truncate">{selectedPerson.firstName} {selectedPerson.lastName}</span>
                        </>
                    ) : (
                        <span className="text-gray-400">{placeholder}</span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    {value && (
                        <X
                            size={16}
                            className="text-gray-400 hover:text-white"
                            onClick={handleClear}
                        />
                    )}
                    <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-gray-700 rounded-lg shadow-xl border border-gray-600 z-50 flex flex-col max-h-80">
                    {/* Search Input */}
                    <div className="p-2 border-b border-gray-600">
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 text-gray-400" size={14} />
                            <input
                                type="text"
                                placeholder="Search..."
                                className="w-full bg-gray-800 text-white rounded pl-8 pr-3 py-2 text-sm border border-gray-600 focus:border-blue-500 outline-none"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>

                    {/* Options List */}
                    <div className="overflow-y-auto flex-1">
                        {filteredPeople.length > 0 ? (
                            filteredPeople.map(person => (
                                <button
                                    key={person.id}
                                    type="button"
                                    onClick={() => handleSelect(person.id)}
                                    className={`w-full text-left px-3 py-2 hover:bg-gray-600 flex items-center gap-2 transition-colors ${person.id === value ? 'bg-gray-600' : ''
                                        }`}
                                >
                                    {getGenderIcon(person.gender)}
                                    <span className="truncate text-sm">{person.firstName} {person.lastName}</span>
                                    {person.birthDate && (
                                        <span className="text-xs text-gray-400 ml-auto">
                                            {new Date(person.birthDate).getFullYear()}
                                        </span>
                                    )}
                                </button>
                            ))
                        ) : (
                            <div className="px-3 py-4 text-sm text-gray-400 text-center">
                                No people found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
