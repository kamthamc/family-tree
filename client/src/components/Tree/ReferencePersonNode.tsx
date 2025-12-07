import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { UserCircle, UserCircle2, HelpCircle } from 'lucide-react';
import type { Person } from '../../api';

// Reference style colors matching the edge cycle
const GENERATION_COLORS = [
    '#F2677C', // Pink
    '#9E8CEB', // Purple
    '#6893F7', // Blue
    '#F0B95B', // Yellow
    '#64D0A6', // Green
];

function ReferencePersonNode({ data, selected }: NodeProps) {
    const { person, generationDepth: rawGenerationDepth, isPlaceholder, label } = data as {
        person?: Person;
        generationDepth?: number;
        isPlaceholder?: boolean;
        label?: string;
    };

    if (isPlaceholder) {
        return (
            <div className="w-60 h-20 bg-slate-950/80 border-2 border-dashed border-slate-600 rounded-xl flex items-center justify-center text-slate-400 font-medium select-none backdrop-blur-sm">
                <span>{label || 'Unknown'}</span>
                {/* Connection points hidden but present for layout */}
                <Handle type="target" position={Position.Top} className="!bg-slate-500 !w-2 !h-2 opacity-50" />
                <Handle type="source" position={Position.Bottom} className="!bg-slate-500 !w-2 !h-2 opacity-50" />
                <Handle id="left-target" type="target" position={Position.Left} className="!opacity-0" />
                <Handle id="right-target" type="target" position={Position.Right} className="!opacity-0" />
                <Handle id="left-source" type="source" position={Position.Left} className="!bg-slate-500 !w-2 !h-2 opacity-50" />
                <Handle id="right-source" type="source" position={Position.Right} className="!bg-slate-500 !w-2 !h-2 opacity-50" />
            </div>
        )
    }

    if (!person) return null;

    const generationDepth = rawGenerationDepth ?? 0;

    const colorIndex = Math.abs(generationDepth) % GENERATION_COLORS.length;
    const accentColor = GENERATION_COLORS[colorIndex];

    const dob = person.birthDate ? new Date(person.birthDate).getFullYear() : '';
    const dod = person.deathDate ? new Date(person.deathDate).getFullYear() : '';
    const dateRange = dob ? `${dob}${dod ? ` - ${dod}` : ''}` : '';

    return (
        <div
            className={`relative rounded-xl overflow-hidden shadow-lg transition-transform hover:scale-105 bg-slate-900 border border-slate-700
                ${selected ? 'ring-2 ring-offset-2 ring-offset-slate-950 ring-blue-500' : ''}`}
            style={{
                width: '240px',
                minHeight: '80px',
                borderLeft: `6px solid ${accentColor}`,
            }}
        >
            <Handle type="target" position={Position.Top} className="!bg-transparent !w-px !h-px !border-0 opacity-0" />
            <Handle type="source" position={Position.Top} id="top-source" className="!bg-transparent !w-px !h-px !border-0 opacity-0" />

            <Handle type="target" position={Position.Left} id="left-target" className="!bg-transparent !w-px !h-px !border-0 opacity-0" />
            <Handle type="source" position={Position.Left} id="left-source" className="!bg-transparent !w-px !h-px !border-0 opacity-0" />

            <Handle type="target" position={Position.Right} id="right-target" className="!bg-transparent !w-px !h-px !border-0 opacity-0" />
            <Handle type="source" position={Position.Right} id="right-source" className="!bg-transparent !w-px !h-px !border-0 opacity-0" />

            <div className="flex h-full">
                {/* Photo Section */}
                {person.profileImage ? (
                    <div className="w-20 h-20 shrink-0 border-r border-slate-700/50">
                        <img
                            src={person.profileImage}
                            alt={person.firstName || ''}
                            className="w-full h-full object-cover"
                        />
                    </div>
                ) : (
                    <div className="w-20 h-20 shrink-0 flex items-center justify-center bg-slate-800 text-slate-500 border-r border-slate-700/50">
                        {person.gender === 'male' ? (
                            <UserCircle className="w-12 h-12" color="#60a5fa" />
                        ) : person.gender === 'female' ? (
                            <UserCircle2 className="w-12 h-12" color="#ec4899" />
                        ) : (
                            <HelpCircle className="w-12 h-12" color="#9ca3af" />
                        )}
                    </div>
                )}

                {/* Details Section */}
                <div className="flex-1 p-3 flex flex-col justify-center min-w-0 bg-slate-900">
                    <h3 className="text-slate-100 font-bold text-base leading-tight truncate tracking-tight mb-0.5" title={`${person.firstName} ${person.lastName}`}>
                        {person.firstName} {person.lastName}
                    </h3>

                    {dateRange && (
                        <p className="text-xs text-slate-400 font-medium">
                            {dateRange}
                        </p>
                    )}
                </div>
            </div>

            <Handle type="source" position={Position.Bottom} className="!bg-transparent !w-px !h-px !border-0 opacity-0" />
        </div>
    );
}

export default memo(ReferencePersonNode);
