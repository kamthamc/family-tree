import { memo } from 'react';

interface GenerationSectionProps {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    generation: number;
    label: string;
}

const GENERATION_COLORS = [
    { bg: '#FEE2E2', border: '#FCA5A5' }, // Red/Pink - Gen Alpha
    { bg: '#DBEAFE', border: '#93C5FD' }, // Blue - Gen Z
    { bg: '#FEF3C7', border: '#FCD34D' }, // Yellow - Millennial
    { bg: '#FFEDD5', border: '#FDBA74' }, // Orange - Gen X
    { bg: '#FCE7F3', border: '#F9A8D4' }, // Pink - Boomer
    { bg: '#E0E7FF', border: '#A5B4FC' }, // Indigo - Silent
    { bg: '#D1FAE5', border: '#6EE7B7' }, // Green - Greatest
    { bg: '#E5E7EB', border: '#9CA3AF' }, // Gray - Lost
];

export default memo(function GenerationSection({
    x,
    y,
    width,
    height,
    generation,
    label,
}: GenerationSectionProps) {
    const colorIndex = generation % GENERATION_COLORS.length;
    const colors = GENERATION_COLORS[colorIndex];

    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill={colors.bg}
                stroke={colors.border}
                strokeWidth={2}
                rx={8}
                opacity={0.4}
            />
            <text
                x={x + 10}
                y={y + 20}
                fill={colors.border}
                fontSize={12}
                fontWeight="600"
                opacity={0.8}
            >
                {label}
            </text>
        </g>
    );
});
