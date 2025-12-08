import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Info } from 'lucide-react';
import { useEffect } from 'react';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ConfirmModal({
    isOpen,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    isDestructive = false,
    onConfirm,
    onCancel
}: ConfirmModalProps) {
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (isOpen && e.key === 'Escape') onCancel();
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onCancel]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="modal-title"
                    aria-describedby="modal-description"
                >
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onCancel}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        aria-hidden="true"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="relative w-full max-w-md bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-6 overflow-hidden"
                    >
                        <div className="flex gap-4">
                            <div className={`p-3 rounded-full h-fit flex-shrink-0 ${isDestructive ? 'bg-red-900/30 text-red-500' : 'bg-blue-900/30 text-blue-500'}`}>
                                {isDestructive ? <AlertTriangle size={24} /> : <Info size={24} />}
                            </div>
                            <div className="flex-1">
                                <h3 id="modal-title" className="text-lg font-bold text-white mb-2">{title}</h3>
                                <p id="modal-description" className="text-slate-300 text-sm leading-relaxed mb-6">
                                    {message}
                                </p>

                                <div className="flex justify-end gap-3">
                                    <button
                                        onClick={onCancel}
                                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors font-medium border border-transparent hover:border-slate-500"
                                    >
                                        {cancelText}
                                    </button>
                                    <button
                                        onClick={onConfirm}
                                        className={`px-4 py-2 text-white text-sm rounded-lg transition-colors font-medium shadow-lg ${isDestructive
                                            ? 'bg-red-600 hover:bg-red-500 shadow-red-900/20'
                                            : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20'
                                            }`}
                                    >
                                        {confirmText}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
