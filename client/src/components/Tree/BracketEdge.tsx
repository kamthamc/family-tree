import { BaseEdge, type EdgeProps } from '@xyflow/react';

export default function BracketEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    style = {},
    markerEnd,
}: EdgeProps) {
    // This edge connects union nodes to children
    // We want to create a clean orthogonal path:
    // 1. Vertical line down from union node
    // 2. Horizontal line (this will be shared among siblings)
    // 3. Vertical line down to child

    const busOffset = 40; // Distance below union node for the horizontal bus line

    // Calculate the path using SVG path commands
    const path = `M ${sourceX},${sourceY} L ${sourceX},${sourceY + busOffset} L ${targetX},${sourceY + busOffset} L ${targetX},${targetY}`;

    return (
        <BaseEdge
            id={id}
            path={path}
            markerEnd={markerEnd}
            style={style}
        />
    );
}
