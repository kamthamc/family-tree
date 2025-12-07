import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit2, X, User, Calendar } from 'lucide-react';
import type { Person } from '../api';

interface PersonQuickViewProps {
    person: Person;
    position: { x: number; y: number };
    onClose: () => void;
    onEdit: () => void;
}

export default function PersonQuickView({ person, position, onClose, onEdit }: PersonQuickViewProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [adjustedPos, setAdjustedPos] = useState(position);

    useEffect(() => {
        if (cardRef.current) {
            const rect = cardRef.current.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            let newX = position.x;
            let newY = position.y;

            // Check right edge
            if (newX + rect.width > viewportWidth - 20) {
                newX = viewportWidth - rect.width - 20;
            }

            // Check bottom edge
            if (newY + rect.height > viewportHeight - 20) {
                newY = newY - rect.height - 20; // Flip to top
            }

            // Check left edge
            if (newX < 20) newX = 20;
            // Check top edge
            if (newY < 20) newY = 20;

            setAdjustedPos({ x: newX, y: newY });
        }
    }, [position]);

    const calculateAge = (birthDate: string | null, deathDate: string | null) => {
        if (!birthDate) return null;
        const start = new Date(birthDate);
        const end = deathDate ? new Date(deathDate) : new Date();
        const age = end.getFullYear() - start.getFullYear();
        const m = end.getMonth() - start.getMonth();
        if (m < 0 || (m === 0 && end.getDate() < start.getDate())) {
            return age - 1;
        }
        return age;
    };

    const age = calculateAge(person.birthDate, person.deathDate);

    return (
        <AnimatePresence>
            <motion.div
                ref={cardRef}
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                transition={{ duration: 0.2 }}
                className="absolute z-50 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-xl shadow-2xl w-80 overflow-hidden"
                style={{
                    left: adjustedPos.x,
                    top: adjustedPos.y,
                }}
            >
                {/* Header Image & Actions */}
                <div className="relative h-24 bg-gradient-to-r from-blue-900/50 to-purple-900/50">
                    <button
                        onClick={onClose}
                        className="absolute top-2 right-2 p-1.5 bg-black/20 hover:bg-black/40 rounded-full text-white/70 hover:text-white transition-colors z-10"
                    >
                        <X size={16} />
                    </button>

                    <div className="absolute -bottom-10 left-6">
                        <div className="w-20 h-20 rounded-full border-4 border-gray-900 bg-gray-800 overflow-hidden shadow-lg">
                            {person.profileImage ? (
                                <img src={person.profileImage} alt={person.firstName || ''} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold text-xl">
                                    {person.firstName?.[0]}{person.lastName?.[0]}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="pt-12 p-6">
                    <div className="mb-4">
                        <h3 className="text-xl font-bold text-white leading-tight">
                            {person.firstName} {person.middleName} {person.lastName}
                        </h3>
                        {person.nickname && (
                            <p className="text-blue-400 text-sm font-medium">"{person.nickname}"</p>
                        )}
                        <div className="flex items-center gap-2 mt-1 text-gray-400 text-xs">
                            <span className={`px-2 py-0.5 rounded-full border ${person.gender === 'Female' ? 'border-pink-500/30 text-pink-300 bg-pink-500/10' : person.gender === 'Male' ? 'border-blue-500/30 text-blue-300 bg-blue-500/10' : 'border-gray-500/30 text-gray-300'}`}>
                                {person.gender || 'Unknown'}
                            </span>
                            {age !== null && <span>• {age} years old</span>}
                        </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-gray-800/50 p-2 rounded border border-gray-700/50">
                            <div className="flex items-center gap-1.5 text-gray-500 text-[10px] uppercase font-bold mb-1">
                                <Calendar size={10} /> Born
                            </div>
                            <div className="text-sm text-gray-200 truncate">{person.birthDate || '-'}</div>
                        </div>
                        <div className="bg-gray-800/50 p-2 rounded border border-gray-700/50">
                            <div className="flex items-center gap-1.5 text-gray-500 text-[10px] uppercase font-bold mb-1">
                                <User size={10} /> Status
                            </div>
                            <div className="text-sm text-gray-200">{person.deathDate ? 'Deceased' : 'Living'}</div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex gap-2 mt-2 pt-4 border-t border-gray-800">
                        <button
                            onClick={onEdit}
                            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <Edit2 size={14} /> Full Profile
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
