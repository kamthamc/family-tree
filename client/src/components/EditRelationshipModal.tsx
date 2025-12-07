import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Relationship } from '../api';

interface EditRelationshipModalProps {
    relationship: Relationship;
    onClose: () => void;
}

export default function EditRelationshipModal({ relationship, onClose }: EditRelationshipModalProps) {
    const queryClient = useQueryClient();
    const [type, setType] = useState(relationship.type);

    const updateMutation = useMutation({
        mutationFn: () => api.updateRelationship(relationship.id, type),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['relationships'] });
            onClose();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: () => api.deleteRelationship(relationship.id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['relationships'] });
            onClose();
        },
    });

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6"
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Edit Relationship</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
                </div>

                <div className="mb-6">
                    <label className="block text-sm text-gray-400 mb-1">Relationship Type</label>
                    <select
                        className="w-full bg-gray-700 rounded p-2 text-white border border-gray-600 focus:border-blue-500 outline-none capitalize"
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                    >
                        <option value="parent">Parent</option>
                        <option value="spouse">Spouse</option>
                        <option value="divorced">Divorced</option>
                    </select>
                </div>

                <div className="flex justify-between gap-2">
                    <button
                        onClick={() => deleteMutation.mutate()}
                        className="px-4 py-2 bg-red-900/50 hover:bg-red-900 text-red-200 rounded flex items-center gap-2"
                    >
                        <Trash2 size={18} /> Delete
                    </button>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-gray-300 hover:bg-gray-700 rounded">Cancel</button>
                        <button
                            onClick={() => updateMutation.mutate()}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium"
                        >
                            Save
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
