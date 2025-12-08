import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

export function VersionDisplay() {
    const [serverVersion, setServerVersion] = useState<string>('...');
    const [showChangelog, setShowChangelog] = useState(false);
    const [changelogContent, setChangelogContent] = useState<string>('Loading...');

    const clientVersion = __APP_VERSION__;

    useEffect(() => {
        fetch('/api/version')
            .then(res => res.json())
            .then(data => setServerVersion(data.server))
            .catch(() => setServerVersion('Offline'));
    }, []);

    const handleOpenChangelog = () => {
        setShowChangelog(true);
        fetch('/api/changelog')
            .then(res => res.text())
            .then(text => setChangelogContent(text))
            .catch(() => setChangelogContent('Failed to load changelog.'));
    };

    return (
        <>
            <button
                onClick={handleOpenChangelog}
                className="text-[10px] text-gray-500 font-mono mt-4 pt-2 border-t border-gray-800/50 w-full flex justify-between px-2 opacity-50 hover:opacity-100 transition-opacity cursor-pointer hover:bg-slate-900/50 rounded"
                title="Click to view What's New"
            >
                <span>Client: v{clientVersion}</span>
                <span>Server: v{serverVersion}</span>
            </button>

            {showChangelog && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-slate-800">
                            <h2 className="text-lg font-semibold text-white">What's New</h2>
                            <button
                                onClick={() => setShowChangelog(false)}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-6 bg-slate-950/50 custom-scrollbar">
                            <pre className="font-mono text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                                {changelogContent}
                            </pre>
                        </div>
                        <div className="p-4 border-t border-slate-800 text-right text-xs text-slate-500">
                            v{clientVersion} / v{serverVersion}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
