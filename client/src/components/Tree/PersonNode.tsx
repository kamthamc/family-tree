import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import type { Person } from '../../api';

interface PersonNodeProps extends NodeProps {
    data: {
        label: string;
        person: Person;
        generationColor?: string;
        generationLabel?: string;
    }
}

function PersonNode({ data }: PersonNodeProps) {
    const { person, generationColor, generationLabel } = data;

    // Calculate age (logic duplicated from QuickView, maybe unify later)
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
        <div
            className="px-4 py-3 shadow-lg rounded-xl bg-gray-800 border-2 min-w-[200px] relative overflow-hidden group transition-all hover:scale-105"
            style={{
                borderColor: generationColor || '#374151',
                boxShadow: generationColor ? `0 4px 20px -5px ${generationColor}40` : undefined
            }}
        >
            {/* Generation Badge */}
            {generationLabel && (
                <div
                    className="absolute top-0 right-0 px-2 py-0.5 text-[10px] uppercase font-bold text-white rounded-bl-lg opacity-70"
                    style={{ backgroundColor: generationColor || '#4b5563' }}
                >
                    {generationLabel}
                </div>
            )}
            <Handle type="target" position={Position.Top} className="opacity-0" />

            <div className="w-12 h-12 rounded-full bg-gray-700 overflow-hidden border border-gray-500 flex-shrink-0">
                {person.profileImage ? (
                    <img src={person.profileImage} alt={person.firstName || ''} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-lg">
                        {person.firstName?.[0]}
                    </div>
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="font-bold text-white truncate flex items-center gap-2">
                    <span>{person.nickname || person.firstName} {person.nickname ? '' : person.lastName}</span>
                    {person.birthDate && (
                        <span className="text-gray-400 text-xs font-normal">
                            ({(() => {
                                const y = new Date(person.birthDate).getFullYear();
                                return isNaN(y) ? '?' : y;
                            })()}
                            {person.deathDate && ` - ${new Date(person.deathDate).getFullYear()}`}
                            )
                        </span>
                    )}
                </div>
                <div className="text-xs text-gray-400 flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] border ${person.gender === 'Female' ? 'border-pink-500/30 text-pink-300 bg-pink-500/10' :
                        person.gender === 'Male' ? 'border-blue-500/30 text-blue-300 bg-blue-500/10' :
                            'border-gray-600 text-gray-400'
                        }`}>
                        {person.gender || 'Unknown'}
                    </span>
                    {age !== null && <span>{age} yrs</span>}
                </div>
            </div>

            <Handle type="source" position={Position.Bottom} className="opacity-0" />

            {/* Side handles for spouses */}
            <Handle type="source" position={Position.Right} id="right-source" style={{ right: -8, top: '50%', background: '#ec4899', opacity: 0 }} />
            <Handle type="target" position={Position.Right} id="right-target" style={{ right: -8, top: '50%', background: '#ec4899', opacity: 0 }} />
            <Handle type="source" position={Position.Left} id="left-source" style={{ left: -8, top: '50%', background: '#ec4899', opacity: 0 }} />
            <Handle type="target" position={Position.Left} id="left-target" style={{ left: -8, top: '50%', background: '#ec4899', opacity: 0 }} />
        </div>
    );
}

const MemoizedPersonNode = memo(PersonNode);
export default MemoizedPersonNode;
