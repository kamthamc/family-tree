import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';

// Same generation colors as ReferencePersonNode
const GENERATION_COLORS = [
    '#F2677C', // Pink
    '#9E8CEB', // Purple
    '#6893F7', // Blue
    '#F0B95B', // Yellow
    '#64D0A6', // Green
];

function CoupleGroupNode(props: NodeProps) {
    const yearRange = props.data?.yearRange as string | undefined;
    const generationDepth = (props.data?.generationDepth as number) ?? 0;

    // Get generation-specific color
    const colorIndex = Math.abs(generationDepth) % GENERATION_COLORS.length;
    const accentColor = GENERATION_COLORS[colorIndex];

    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                backgroundColor: `${accentColor}15`, // 15 is ~8% opacity in hex
                backdropFilter: 'blur(4px)',
                borderRadius: '16px',
                border: `1px solid ${accentColor}30`, // 30 is ~19% opacity
                boxShadow: `0 4px 6px -1px ${accentColor}20`,
            }}
            className="couple-group-node relative"
        >
            {/* Year Range Label */}
            {yearRange && (
                <div className="absolute bottom-2 left-4 text-xs text-slate-400 font-mono select-none">
                    {yearRange}
                </div>
            )}
        </div>
    );
}

export default memo(CoupleGroupNode);
