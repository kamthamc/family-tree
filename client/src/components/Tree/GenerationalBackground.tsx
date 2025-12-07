import { memo } from 'react';
import { useNodes } from '@xyflow/react';

const GENERATION_COLORS = [
    '#FEE2E2', // Pink
    '#EDE9FE', // Purple
    '#DBEAFE', // Blue
    '#FEF3C7', // Yellow
    '#D1FAE5', // Green
];

const BORDER_COLORS = [
    '#FCA5A5', // Pink
    '#C4B5FD', // Purple
    '#93C5FD', // Blue
    '#FCD34D', // Yellow
    '#6EE7B7', // Green
];

function GenerationalBackground() {
    const nodes = useNodes();

    // Group nodes by generation
    const generationBounds = new Map<number, { minX: number; maxX: number; minY: number; maxY: number }>();
    const nodePadding = 60; // Padding around the nodes for the "bubble"

    nodes.forEach(node => {
        // Skip hidden nodes or non-person nodes if you only want to group people
        if (node.hidden) return;

        // We only care about nodes that have a generation depth assigned
        if (typeof node.data?.generationDepth !== 'number') return;

        const depth = node.data.generationDepth as number;
        const x = node.position.x;
        const y = node.position.y;
        const w = (node.measured?.width ?? 240); // User measured width or default
        const h = (node.measured?.height ?? 80);

        const current = generationBounds.get(depth) || {
            minX: Infinity,
            maxX: -Infinity,
            minY: Infinity,
            maxY: -Infinity
        };

        generationBounds.set(depth, {
            minX: Math.min(current.minX, x),
            maxX: Math.max(current.maxX, x + w),
            minY: Math.min(current.minY, y),
            maxY: Math.max(current.maxY, y + h)
        });
    });

    return (
        <svg
            className="react-flow__background pointer-events-none absolute top-0 left-0 w-full h-full z-0"
            style={{ width: '100%', height: '100%' }}
        >
            {Array.from(generationBounds.entries()).map(([depth, bounds]) => {
                const colorIndex = Math.abs(depth) % GENERATION_COLORS.length;
                const fill = GENERATION_COLORS[colorIndex];
                const border = BORDER_COLORS[colorIndex];

                const x = bounds.minX - nodePadding;
                const y = bounds.minY - nodePadding;
                const width = (bounds.maxX - bounds.minX) + (nodePadding * 2);
                const height = (bounds.maxY - bounds.minY) + (nodePadding * 2);

                return (
                    <g key={`gen-${depth}`}>
                        {/* Generation Label (Optional) */}
                        <text
                            x={x + 20}
                            y={y + 30}
                            fill={border}
                            className="text-sm font-bold uppercase tracking-widest opacity-60"
                            style={{ fontFamily: 'sans-serif' }}
                        >
                            Generation {depth}
                        </text>

                        <rect
                            x={x}
                            y={y}
                            width={width}
                            height={height}
                            rx={40} // Large radius for "bubble" look
                            fill={fill}
                            stroke={border}
                            strokeWidth={2}
                            opacity={0.5}
                        />
                    </g>
                );
            })}
        </svg>
    );
}

export default memo(GenerationalBackground);
