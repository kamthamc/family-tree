import { useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import Papa from 'papaparse';
import { api, type Person, type Relationship } from '../api';
import { useQueryClient } from '@tanstack/react-query';

interface CSVManagerProps {
    people?: Person[];
    relationships?: Relationship[];
}

export default function CSVManager({ people, relationships }: CSVManagerProps) {
    const queryClient = useQueryClient();
    const peopleInputRef = useRef<HTMLInputElement>(null);
    const relInputRef = useRef<HTMLInputElement>(null);
    const [importing, setImporting] = useState(false);

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
    };

    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>, type: 'people' | 'relationships') => {
        const file = event.target.files?.[0];
        if (!file) return;

        setImporting(true);
        Papa.parse(file, {
            header: true,
            complete: async (results) => {
                try {
                    const data = results.data;
                    // Clean up empty rows
                    const cleanData = data.filter((row: any) => Object.values(row).some(val => val));

                    if (type === 'people') {
                        // We need to match the Person interface. 
                        // CSV parsing treats everything as strings usually, but our interface expects specific fields.
                        // For now we assume the CSV matches the structure exported.
                        await api.importData({ people: cleanData as Person[], relationships: [] });
                    } else {
                        await api.importData({ people: [], relationships: cleanData as Relationship[] });
                    }

                    queryClient.invalidateQueries({ queryKey: ['people'] });
                    queryClient.invalidateQueries({ queryKey: ['relationships'] });
                    alert(`Successfully imported ${type}`);
                } catch (error) {
                    console.error('Import failed:', error);
                    alert('Import failed. Check console for details.');
                } finally {
                    setImporting(false);
                    if (event.target) event.target.value = '';
                }
            },
            error: (error) => {
                console.error('CSV Parse error:', error);
                setImporting(false);
            }
        });
    };

    return (
        <div className="flex gap-2">
            <div className="relative group">
                <button
                    disabled={importing}
                    className="bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 disabled:opacity-50"
                    title="Import/Export CSV"
                >
                    {importing ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                    CSV
                </button>
                <div className="absolute top-full right-0 mt-2 bg-gray-800 rounded-lg shadow-xl p-2 flex flex-col gap-2 min-w-[200px] hidden group-hover:flex z-50">
                    <button onClick={() => handleExport('people')} className="text-left px-2 py-1 hover:bg-gray-700 rounded text-sm text-gray-200">Export People</button>
                    <button onClick={() => handleExport('relationships')} className="text-left px-2 py-1 hover:bg-gray-700 rounded text-sm text-gray-200">Export Relationships</button>
                    <div className="h-px bg-gray-700 my-1" />
                    <button onClick={() => peopleInputRef.current?.click()} className="text-left px-2 py-1 hover:bg-gray-700 rounded text-sm text-gray-200">Import People</button>
                    <button onClick={() => relInputRef.current?.click()} className="text-left px-2 py-1 hover:bg-gray-700 rounded text-sm text-gray-200">Import Relationships</button>
                </div>
            </div>

            <input type="file" ref={peopleInputRef} className="hidden" accept=".csv" onChange={(e) => handleImport(e, 'people')} />
            <input type="file" ref={relInputRef} className="hidden" accept=".csv" onChange={(e) => handleImport(e, 'relationships')} />
        </div>
    );
}
