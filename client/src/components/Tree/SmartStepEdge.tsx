import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';



export default function SmartStepEdge({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
}: EdgeProps) {
    const [edgePath] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 25,
    });

    // Standardize edge color
    const strokeColor = '#64748b'; // Slate-500

    return (
        <BaseEdge
            path={edgePath}
            markerEnd={markerEnd}
            style={{
                ...style,
                stroke: strokeColor,
                strokeWidth: 2,
            }}
        />
    );
}
