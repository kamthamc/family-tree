import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    action?: React.ReactNode;
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center h-full w-full p-8 text-center bg-slate-900 border-2 border-dashed border-slate-700 rounded-xl">
            <div className="bg-slate-800 p-4 rounded-full mb-4 shadow-lg shadow-black/20">
                <Icon size={48} className="text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
            <p className="text-slate-400 max-w-md mb-6">{description}</p>
            {action && (
                <div className="flex gap-3">
                    {action}
                </div>
            )}
        </div>
    );
}
