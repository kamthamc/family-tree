import { useState, useTransition } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ChevronDown, Plus, TreeDeciduous } from 'lucide-react';
import { api } from '../api';
import toast from 'react-hot-toast';

import ConfirmModal from './ConfirmModal';

export default function FamilyTreeSelector() {
    const { familyTrees, currentFamilyTree, setCurrentFamilyTreeId, refreshFamilyTrees } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newTreeName, setNewTreeName] = useState('');
    const [isPending, startTransition] = useTransition();

    // Modal State
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        type: 'delete' | 'duplicate' | null;
        treeId: string;
        treeName: string;
    }>({ isOpen: false, type: null, treeId: '', treeName: '' });

    const handleCreateTree = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const newTree = await api.createFamilyTree({ name: newTreeName });
            await refreshFamilyTrees();
            setCurrentFamilyTreeId(newTree.id);
            setNewTreeName('');
            setIsCreating(false);
            setIsOpen(false);
        } catch (error) {
            console.error('Failed to create tree:', error);
        }
    };

    return (
        <div className={`relative z-50 ${isPending ? 'opacity-70 contrast-75' : ''}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition-colors"
            >
                <TreeDeciduous size={18} className="text-blue-400" />
                <span className="font-medium max-w-[150px] truncate">
                    {currentFamilyTree ? currentFamilyTree.name : 'Select Family Tree'}
                </span>
                <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => { setIsOpen(false); setIsCreating(false); }}
                    />
                    <div className="absolute top-full left-0 mt-2 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                        {isCreating ? (
                            <div className="p-4">
                                <h3 className="text-sm font-semibold text-white mb-3">Create New Tree</h3>
                                <form onSubmit={handleCreateTree}>
                                    <input
                                        type="text"
                                        value={newTreeName}
                                        onChange={(e) => setNewTreeName(e.target.value)}
                                        placeholder="Tree Name (e.g. Smiths)"
                                        className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm mb-3 focus:border-blue-500 outline-none"
                                        autoFocus
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsCreating(false)}
                                            className="flex-1 px-3 py-1.5 bg-slate-700 text-slate-300 text-xs rounded hover:bg-slate-600"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={!newTreeName.trim()}
                                            className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-500 disabled:opacity-50"
                                        >
                                            Create
                                        </button>
                                    </div>
                                </form>
                            </div>
                        ) : (
                            <>
                                <div className="max-h-64 overflow-y-auto py-2">
                                    <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">My Trees</div>
                                    {familyTrees.owned.length === 0 && (
                                        <div className="px-3 py-2 text-sm text-slate-400 italic">No trees yet</div>
                                    )}
                                    {familyTrees.owned.map(tree => (
                                        <div key={tree.id} className="group flex items-center justify-between hover:bg-slate-700 transition-colors pr-2">
                                            <button
                                                onClick={() => {
                                                    startTransition(() => {
                                                        setCurrentFamilyTreeId(tree.id);
                                                    });
                                                    setIsOpen(false);
                                                }}
                                                className={`flex-1 text-left px-4 py-2 text-sm flex items-center justify-between ${currentFamilyTree?.id === tree.id ? 'text-blue-200' : 'text-slate-200'}`}
                                            >
                                                <span className="truncate">{tree.name}</span>
                                                {currentFamilyTree?.id === tree.id && <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>}
                                            </button>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setConfirmModal({
                                                            isOpen: true,
                                                            type: 'duplicate',
                                                            treeId: tree.id,
                                                            treeName: tree.name
                                                        });
                                                    }}
                                                    className="hidden group-hover:block p-1 text-slate-400 hover:text-white"
                                                    title="Duplicate Tree"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setConfirmModal({
                                                            isOpen: true,
                                                            type: 'delete',
                                                            treeId: tree.id,
                                                            treeName: tree.name
                                                        });
                                                    }}
                                                    className="hidden group-hover:block p-1 text-slate-400 hover:text-red-400"
                                                    title="Delete Tree"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    {familyTrees.shared.length > 0 && (
                                        <>
                                            <div className="px-3 py-1.5 mt-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Shared with Me</div>
                                            {familyTrees.shared.map(tree => (
                                                <button
                                                    key={tree.id}
                                                    onClick={() => {
                                                        setCurrentFamilyTreeId(tree.id);
                                                        setIsOpen(false);
                                                    }}
                                                    className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700 transition-colors flex items-center justify-between ${currentFamilyTree?.id === tree.id ? 'bg-blue-900/30 text-blue-200' : 'text-slate-200'}`}
                                                >
                                                    <span className="truncate">{tree.name}</span>
                                                </button>
                                            ))}
                                        </>
                                    )}
                                </div>
                                <div className="border-t border-slate-700 p-2">
                                    <button
                                        onClick={() => setIsCreating(true)}
                                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-700/50 hover:bg-slate-700 text-blue-400 text-sm rounded-lg transition-colors font-medium"
                                    >
                                        <Plus size={16} /> Create New Tree
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </>
            )}

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.type === 'delete' ? 'Delete Family Tree' : 'Duplicate Family Tree'}
                message={confirmModal.type === 'delete'
                    ? `Are you sure you want to DELETE "${confirmModal.treeName}"? This action cannot be undone and all data will be lost.`
                    : `Do you want to create a copy of "${confirmModal.treeName}"?`
                }
                confirmText={confirmModal.type === 'delete' ? 'Delete' : 'Duplicate'}
                isDestructive={confirmModal.type === 'delete'}
                onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={async () => {
                    try {
                        if (confirmModal.type === 'delete') {
                            await api.deleteFamilyTree(confirmModal.treeId);
                            if (currentFamilyTree?.id === confirmModal.treeId) {
                                setCurrentFamilyTreeId('');
                            }
                        } else if (confirmModal.type === 'duplicate') {
                            const newTree = await api.duplicateFamilyTree(confirmModal.treeId);
                            setCurrentFamilyTreeId(newTree.id);
                        }
                        await refreshFamilyTrees();
                        setConfirmModal({ ...confirmModal, isOpen: false });
                        setIsOpen(false); // Close main selector
                    } catch (err) {
                        console.error(err);
                        toast.error(`Failed to ${confirmModal.type} tree`);
                    }
                }}
            />
        </div>
    );
}
