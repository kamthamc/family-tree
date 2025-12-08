import { useRef, useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Download, Loader2, ChevronDown } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import Papa from 'papaparse';
import { api, type Person, type Relationship } from '../api';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

interface CSVManagerProps {
    people?: Person[];
    relationships?: Relationship[];
}

export default function CSVManager({ people, relationships }: CSVManagerProps) {
    const queryClient = useQueryClient();
    const peopleInputRef = useRef<HTMLInputElement>(null);
    const relInputRef = useRef<HTMLInputElement>(null);
    const [importing, setImporting] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef]);

    const handleExport = (type: 'people' | 'relationships') => {
        const data = type === 'people' ? people : relationships;
        if (!data || data.length === 0) return;

        const csv = Papa.unparse(data as any);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${type}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsOpen(false);
    };

    const { currentFamilyTree, setCurrentFamilyTreeId, refreshFamilyTrees } = useAuth();

    const [pendingImport, setPendingImport] = useState<{ file: File, type: 'people' | 'relationships' } | null>(null);

    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>, type: 'people' | 'relationships') => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Auto-create tree if none exists
        if (!currentFamilyTree) {
            setPendingImport({ file, type });
            if (event.target) event.target.value = ''; // Reset input to allow re-selection if cancelled
            return;
        }

        processImport(file, type);
        if (event.target) event.target.value = '';
    };

    const confirmCreateTree = async () => {
        if (!pendingImport) return;

        try {
            const newTree = await api.createFamilyTree({ name: 'My Family Tree' });
            await refreshFamilyTrees();
            setCurrentFamilyTreeId(newTree.id);
            // Process the pending import with the new tree
            await processImport(pendingImport.file, pendingImport.type);
        } catch (e: any) {
            toast.error("Failed to create family tree: " + e.message);
        } finally {
            setPendingImport(null);
        }
    };

    const processImport = (file: File, type: 'people' | 'relationships') => {
        setImporting(true);
        setIsOpen(false);
        Papa.parse(file, {
            header: true,
            complete: async (results) => {
                try {
                    const data = results.data;
                    // Clean up empty rows and ensure required fields
                    const cleanData = data.filter((row: any) => Object.values(row).some(val => val));

                    if (type === 'people') {
                        await api.importData({ people: cleanData as Person[], relationships: [] });
                    } else {
                        await api.importData({ people: [], relationships: cleanData as Relationship[] });
                    }

                    queryClient.invalidateQueries({ queryKey: ['people'] });
                    queryClient.invalidateQueries({ queryKey: ['relationships'] });
                    toast.success(`Successfully imported ${type}`);
                } catch (error: any) {
                    console.error('Import failed:', error);
                    toast.error(`Import failed: ${error.message || 'Unknown error'}`);
                } finally {
                    setImporting(false);
                }
            },
            error: (error) => {
                console.error('CSV Parse error:', error);
                setImporting(false);
            }
        });
    }

    return (
        <div className="flex gap-2" ref={wrapperRef}>
            <div className="relative">
                <button
                    disabled={importing}
                    onClick={() => setIsOpen(!isOpen)}
                    className="bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 disabled:opacity-50"
                    title="Import/Export CSV"
                >
                    {importing ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                    CSV <ChevronDown size={14} className={isOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
                </button>
                {isOpen && (
                    <div className="absolute top-full right-0 mt-2 bg-gray-800 rounded-lg shadow-xl p-2 flex flex-col gap-2 min-w-[200px] z-50 border border-gray-700">
                        <button onClick={() => handleExport('people')} className="text-left px-2 py-1 hover:bg-gray-700 rounded text-sm text-gray-200">Export People</button>
                        <button onClick={() => handleExport('relationships')} className="text-left px-2 py-1 hover:bg-gray-700 rounded text-sm text-gray-200">Export Relationships</button>
                        <div className="h-px bg-gray-700 my-1" />
                        <button onClick={() => peopleInputRef.current?.click()} className="text-left px-2 py-1 hover:bg-gray-700 rounded text-sm text-gray-200">Import People</button>
                        <button onClick={() => relInputRef.current?.click()} className="text-left px-2 py-1 hover:bg-gray-700 rounded text-sm text-gray-200">Import Relationships</button>
                    </div>
                )}
            </div>

            <input type="file" ref={peopleInputRef} className="hidden" accept=".csv" onChange={(e) => handleImport(e, 'people')} />
            <input type="file" ref={relInputRef} className="hidden" accept=".csv" onChange={(e) => handleImport(e, 'relationships')} />

            {/* Custom Confirmation Dialog replaced with ConfirmModal */}
            <ConfirmModal
                isOpen={!!pendingImport}
                title="Create Family Tree?"
                message={`You don't have a family tree selected. Would you like to create a new tree named "My Family Tree" and import this data into it?`}
                confirmText="Create & Import"
                onCancel={() => {
                    setPendingImport(null);
                    // Reset inputs
                    if (peopleInputRef.current) peopleInputRef.current.value = '';
                    if (relInputRef.current) relInputRef.current.value = '';
                }}
                onConfirm={confirmCreateTree}
            />
        </div>
    );
}
