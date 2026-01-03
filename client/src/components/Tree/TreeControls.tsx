import { Download, Layout, ArrowRightLeft, Search, Filter, RefreshCw } from 'lucide-react';
import { toJpeg } from 'html-to-image';
import CSVManager from '../CSVManager';
import { type Person, type Relationship } from '../../api';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useReactFlow, type Node } from '@xyflow/react';
import type { Options } from 'html-to-image/lib/types';

export interface FilterState {
    labels: string[];
    status: 'all' | 'living' | 'deceased';
    yearRange: { start: number | null; end: number | null };
}

interface TreeControlsProps {
    people?: Person[];
    relationships?: Relationship[];
    onLayoutChange?: () => void;
    layoutDirection?: 'TB' | 'LR';
    onFindRelationship?: () => void;
    onFilterChange: (filters: FilterState) => void;
    onRefreshLayout: () => void;
    // Lineage Props
    lineageRootId?: string | null;
    onClearLineage?: () => void;
}

export default function TreeControls({ people, relationships, onLayoutChange, layoutDirection, onFindRelationship, onFilterChange, onRefreshLayout, lineageRootId, onClearLineage }: TreeControlsProps) {
    const [showFilters, setShowFilters] = useState(false);
    const { getNodes } = useReactFlow();

    // Filter Logic
    const [filters, setFilters] = useState<FilterState>({
        labels: [],
        status: 'all',
        yearRange: { start: null, end: null },
    });

    const [availableLabels, setAvailableLabels] = useState<string[]>([]);

    useEffect(() => {
        if (people) {
            const labels = new Set<string>();
            people.forEach(p => {
                if (p.attributes?.labels) {
                    p.attributes.labels.forEach((l: string) => labels.add(l));
                }
            });
            setAvailableLabels(Array.from(labels).sort());
        }
    }, [people]);

    // Update parent when filters change (debounced)
    useEffect(() => {
        const timer = setTimeout(() => {
            onFilterChange(filters);
        }, 300);
        return () => clearTimeout(timer);
    }, [filters, onFilterChange]);


    const getNodesBounds = (nodes: Node[]) => {
        if (nodes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        nodes.forEach((node) => {
            // Critical: Skip child nodes as their position is relative to parent!
            if (node.parentId) return;
            // Also skip nodes that are hidden or disconnected if necessary, but usually we want visible ones.
            // Check if node has dimensions
            const w = node.measured?.width ?? node.width ?? 0;
            const h = node.measured?.height ?? node.height ?? 0;

            if (w === 0 || h === 0) return; // Skip invisible nodes

            const x = node.position.x;
            const y = node.position.y;

            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x + w > maxX) maxX = x + w;
            if (y + h > maxY) maxY = y + h;
        });

        // Safety check if no bounds found
        if (minX === Infinity) return { x: 0, y: 0, width: 0, height: 0 };

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
        };
    };

    const handleDownload = async () => {
        const nodes = getNodes();
        if (nodes.length === 0) return;

        const bounds = getNodesBounds(nodes);
        if (bounds.width === 0 || bounds.height === 0) {
            toast.error('Cannot export empty tree');
            return;
        }

        const element = document.querySelector('.react-flow__viewport') as HTMLElement;
        if (!element) return;

        // Larger padding to ensure nothing is cut off
        const padding = 50;

        try {
            const imageWidth = bounds.width + padding;
            const imageHeight = bounds.height + padding;

            const options: Options = {
                backgroundColor: '#111827',
                canvasWidth: imageWidth,
                canvasHeight: imageHeight,
                cacheBust: true, // Force reload images
                pixelRatio: 5,
                quality: 1,
                type: 'image/jpeg',
                style: {
                    width: imageWidth + 'px',
                    height: imageHeight + 'px',
                    transform: 'scaleY(1.7)',
                },
                filter: (node: any) => {
                    // Exclude controls, minimap, panels
                    if (node.classList) {
                        return !node.classList.contains('controls') &&
                            !node.classList.contains('react-flow__controls') &&
                            !node.classList.contains('react-flow__minimap') &&
                            !node.classList.contains('react-flow__panel') &&
                            !node.classList.contains('react-flow__background');
                    }
                    return true;
                },
            };

            const dataUrl = await toJpeg(document.querySelector('.react-flow') as HTMLElement, options);

            const link = document.createElement('a');
            link.download = `family-tree-${Date.now()}.jpeg`;
            link.href = dataUrl;
            link.click();
            link.remove();
        } catch (error) {
            console.error('Error exporting image:', error);
            toast.error('Failed to export image. Please try again.');
        }
    };


    const toggleLabel = (label: string) => {
        setFilters(prev => ({
            ...prev,
            labels: prev.labels.includes(label)
                ? prev.labels.filter(l => l !== label)
                : [...prev.labels, label]
        }));
    };

    const rootPerson = lineageRootId && people ? people.find(p => p.id === lineageRootId) : null;

    return (
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 items-end">
            {rootPerson && (
                <div className="bg-blue-600/90 backdrop-blur text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-3 border border-blue-500 animate-in fade-in slide-in-from-top-2">
                    <span className="text-sm font-medium">
                        Lineage: <strong>{rootPerson.firstName} {rootPerson.lastName}</strong>
                    </span>
                    <button
                        onClick={onClearLineage}
                        className="bg-white/20 hover:bg-white/30 p-1 rounded transition-colors"
                        title="Exit Lineage View"
                    >
                        <ArrowRightLeft size={16} className="rotate-90" /> {/* Simulating 'Exchange' or 'Exit' icon */}
                    </button>
                </div>
            )}

            <div className="flex gap-2">
                <button
                    onClick={onRefreshLayout}
                    className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 border border-gray-600"
                    title="Re-compute Layout"
                >
                    <RefreshCw size={18} />
                    <span className="hidden xl:inline">Refresh</span>
                </button>
                <button
                    onClick={onLayoutChange}
                    className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 border border-gray-600"
                    title="Toggle Layout Direction (Vertical/Horizontal)"
                >
                    {layoutDirection === 'TB' ? <Layout size={18} /> : <ArrowRightLeft size={18} />}
                    <span className="hidden xl:inline">Layout</span>
                </button>

                <button
                    onClick={handleDownload}
                    className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 border border-gray-600"
                    title="Export as PNG"
                >
                    <Download size={18} />
                    <span className="hidden xl:inline">Export</span>
                </button>

                <button
                    onClick={onFindRelationship}
                    className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 border border-gray-600"
                    title="Find Relationship"
                >
                    <Search size={18} />
                    <span className="hidden xl:inline">Find Kin</span>
                </button>

                <div className="relative">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 border border-gray-600 ${showFilters || filters.labels.length > 0 || filters.status !== 'all' || filters.yearRange.start || filters.yearRange.end
                            ? 'bg-blue-600 text-white border-blue-500 hover:bg-blue-500'
                            : 'bg-gray-800 text-white hover:bg-gray-700'
                            } `}
                        title="Filter People"
                    >
                        <Filter size={18} />
                        <span className="hidden xl:inline">Filters</span>
                        {(filters.labels.length > 0 || filters.status !== 'all' || filters.yearRange.start || filters.yearRange.end) && (
                            <div className="w-2 h-2 rounded-full bg-yellow-400 absolute top-2 right-2 animate-pulse" />
                        )}
                    </button>

                    {showFilters && (
                        <div className="absolute right-0 top-full mt-2 w-72 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl p-4 z-50">
                            <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                                <h3 className="font-bold text-white text-sm">Filters</h3>
                                <button
                                    onClick={() => {
                                        setFilters({ labels: [], status: 'all', yearRange: { start: null, end: null } });
                                    }}
                                    className="text-xs text-blue-400 hover:text-blue-300"
                                >
                                    Clear All
                                </button>
                            </div>

                            {/* Status Filter */}
                            <div className="mb-4">
                                <label className="block text-xs font-medium text-gray-400 mb-1">Status</label>
                                <select
                                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm"
                                    value={filters.status}
                                    onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
                                >
                                    <option value="all">Show All</option>
                                    <option value="living">Living Only</option>
                                    <option value="deceased">Deceased Only</option>
                                </select>
                            </div>

                            {/* Date Range */}
                            <div className="mb-4">
                                <label className="block text-xs font-medium text-gray-400 mb-1">Birth Year Range</label>
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="number"
                                        placeholder="From"
                                        className="w-1/2 bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm"
                                        value={filters.yearRange.start || ''}
                                        onChange={(e) => setFilters({ ...filters, yearRange: { ...filters.yearRange, start: e.target.value ? parseInt(e.target.value) : null } })}
                                    />
                                    <span className="text-gray-500">-</span>
                                    <input
                                        type="number"
                                        placeholder="To"
                                        className="w-1/2 bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm"
                                        value={filters.yearRange.end || ''}
                                        onChange={(e) => setFilters({ ...filters, yearRange: { ...filters.yearRange, end: e.target.value ? parseInt(e.target.value) : null } })}
                                    />
                                </div>
                            </div>

                            {/* Labels */}
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-2">Labels</label>
                                {availableLabels.length === 0 ? (
                                    <div className="text-gray-500 text-xs italic">No labels found in your tree.</div>
                                ) : (
                                    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                                        {availableLabels.map(label => (
                                            <button
                                                key={label}
                                                onClick={() => toggleLabel(label)}
                                                className={`px-2 py-1 rounded text-xs border ${filters.labels.includes(label)
                                                    ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                                                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
                                                    } `}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <CSVManager people={people} relationships={relationships} />
        </div>
    );
}
