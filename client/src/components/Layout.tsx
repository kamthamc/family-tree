import { Link, Outlet, useLocation } from 'react-router-dom';
import { Users, Network, LogOut, User } from 'lucide-react';
import FamilyTreeSelector from './FamilyTreeSelector';
import { useAuth } from '../contexts/AuthContext';
import { VersionDisplay } from './VersionDisplay';

export default function Layout() {
    const location = useLocation();
    const { logout, user } = useAuth();
    const isActive = (path: string) => location.pathname === path;

    return (
        <div className="flex h-screen bg-slate-950 text-white">
            {/* Sidebar */}
            <nav className="w-16 flex flex-col items-center py-4 bg-slate-900 border-r border-slate-800 space-y-4">
                <Link
                    to="/"
                    className={`p-2 rounded-lg transition-colors ${isActive('/') ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                    title="Tree View"
                >
                    <Network size={24} />
                </Link>
                <Link
                    to="/people"
                    className={`p-2 rounded-lg transition-colors ${isActive('/people') ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                    title="People List"
                >
                    <Users size={24} />
                </Link>

                <div className="mt-auto flex flex-col items-center gap-4">
                    <VersionDisplay />
                    <button
                        onClick={logout}
                        className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-red-400 transition-colors"
                        title="Logout"
                    >
                        <LogOut size={24} />
                    </button>
                </div>
            </nav>

            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top Header */}
                <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6">
                    <div className="flex items-center gap-4">
                        <FamilyTreeSelector />
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="text-right hidden sm:block">
                            <div className="text-sm font-medium text-white">{user?.name}</div>
                            <div className="text-xs text-slate-400">{user?.email}</div>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white">
                            <User size={20} />
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-1 overflow-hidden relative">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
