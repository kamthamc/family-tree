import { Handle, Position, type NodeProps } from '@xyflow/react';

interface UnionNodeProps extends NodeProps {
    data: {
        label: string;
    }
}

export default function UnionNode({ data }: UnionNodeProps) {
    return (
        <div
            className="flex items-center justify-center w-5 h-5 bg-slate-800 rounded-full border border-slate-600 shadow-sm z-50 text-xs text-white"
            title="Union"
        >
            {data.label}

            <Handle type="target" position={Position.Top} className="opacity-0" />
            <Handle type="source" position={Position.Bottom} className="opacity-0" />

            {/* Side handles for spouses to connect to */}
            <Handle type="target" position={Position.Left} id="left-target" className="opacity-0" />
            <Handle type="source" position={Position.Left} id="left-source" className="opacity-0" />
            <Handle type="target" position={Position.Right} id="right-target" className="opacity-0" />
            <Handle type="source" position={Position.Right} id="right-source" className="opacity-0" />
        </div>
    );
}
