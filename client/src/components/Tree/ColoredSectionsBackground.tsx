import { useNodes } from '@xyflow/react';

interface SpousePair {
    p1Id: string;
    p2Id: string;
    unionId: string;
}

interface ColoredSectionsBackgroundProps {
    spousePairs: SpousePair[];
}

const nodeWidth = 200;
const nodeHeight = 80;

export default function ColoredSectionsBackground({ spousePairs }: ColoredSectionsBackgroundProps) {
    const nodes = useNodes();

    // Create a map for quick node lookup
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    return (
        <svg
            className="react-flow__background"
            style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                top: 0,
                left: 0,
                pointerEvents: 'none',
                zIndex: 0,
            }}
        >
            {spousePairs.map((pair, idx) => {
                const p1 = nodeMap.get(pair.p1Id);
                const p2 = nodeMap.get(pair.p2Id);

                if (!p1 || !p2) return null;

                const generationDepth = (typeof p1.data?.generationDepth === 'number' ? p1.data.generationDepth : 0);

                // Color palette based on generation
                const colors = [
                    { bg: '#FEE2E2', border: '#FCA5A5' }, // Pink
                    { bg: '#FFEDD5', border: '#FDBA74' }, // Orange
                    { bg: '#FEF3C7', border: '#FCD34D' }, // Yellow
                    { bg: '#DBEAFE', border: '#93C5FD' }, // Blue
                    { bg: '#D1FAE5', border: '#6EE7B7' }, // Green
                ];
                const colorIndex = generationDepth % colors.length;
                const color = colors[colorIndex];

                // Calculate bounding box for the couple
                const padding = 15;
                const minX = Math.min(p1.position.x, p2.position.x) - padding;
                const maxX = Math.max(p1.position.x + nodeWidth, p2.position.x + nodeWidth) + padding;
                const minY = p1.position.y - padding;
                const height = nodeHeight + padding * 2;
                const width = maxX - minX;

                return (
                    <rect
                        key={`section-${idx}`}
                        x={minX}
                        y={minY}
                        width={width}
                        height={height}
                        fill={color.bg}
                        stroke={color.border}
                        strokeWidth={2}
                        rx={8}
                        opacity={0.6}
                    />
                );
            })}
        </svg>
    );
}
