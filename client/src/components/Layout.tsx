import { Link, Outlet, useLocation } from 'react-router-dom';
import { Users, Network } from 'lucide-react';

export default function Layout() {
    const location = useLocation();
    const isActive = (path: string) => location.pathname === path;

    return (
        <div className="flex h-screen bg-gray-900 text-white">
            <nav className="w-16 flex flex-col items-center py-4 bg-gray-800 border-r border-gray-700 space-y-4">
                <Link
                    to="/"
                    className={`p-2 rounded-lg transition-colors ${isActive('/') ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                    title="Tree View"
                >
                    <Network size={24} />
                </Link>
                <Link
                    to="/people"
                    className={`p-2 rounded-lg transition-colors ${isActive('/people') ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                    title="People List"
                >
                    <Users size={24} />
                </Link>
            </nav>
            <main className="flex-1 overflow-hidden relative">
                <Outlet />
            </main>
        </div>
    );
}
