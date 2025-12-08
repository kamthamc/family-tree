import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, type FamilyTree } from '../api';

interface User {
    id: string;
    email: string;
    name: string;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (data: any) => Promise<void>;
    register: (data: any) => Promise<void>;
    logout: () => void;
    currentFamilyTree: FamilyTree | null;
    setCurrentFamilyTreeId: (id: string) => void;
    familyTrees: { owned: FamilyTree[], shared: FamilyTree[] };
    refreshFamilyTrees: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [familyTrees, setFamilyTrees] = useState<{ owned: FamilyTree[], shared: FamilyTree[] }>({ owned: [], shared: [] });
    const [currentFamilyTreeId, setCurrentFamilyTreeIdState] = useState<string | null>(localStorage.getItem('currentFamilyTreeId'));

    useEffect(() => {
        checkAuth();
    }, []);

    // Effect to fetch family trees when user logs in
    useEffect(() => {
        if (user) {
            refreshFamilyTrees();
        } else {
            setFamilyTrees({ owned: [], shared: [] });
        }
    }, [user]);

    // Update current tree object derived from ID and lists
    const currentFamilyTree = familyTrees.owned.find(t => t.id === currentFamilyTreeId) ||
        familyTrees.shared.find(t => t.id === currentFamilyTreeId) || null;

    const checkAuth = async () => {
        try {
            const token = localStorage.getItem('accessToken');
            if (token) {
                const userData = await api.getMe();
                setUser(userData);
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            logout();
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (data: any) => {
        const response = await api.login(data);
        localStorage.setItem('accessToken', response.accessToken);
        localStorage.setItem('refreshToken', response.refreshToken);
        localStorage.setItem('userKey', response.userKey);
        setUser(response.user);
    };

    const register = async (data: any) => {
        const response = await api.register(data);
        localStorage.setItem('accessToken', response.accessToken);
        localStorage.setItem('refreshToken', response.refreshToken);
        localStorage.setItem('userKey', response.userKey);
        setUser(response.user);
    };

    const logout = () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userKey');
        localStorage.removeItem('currentFamilyTreeId');
        setUser(null);
        setCurrentFamilyTreeIdState(null);
    };

    const refreshFamilyTrees = async () => {
        try {
            const trees = await api.getFamilyTrees();
            setFamilyTrees(trees);

            // Auto-select first tree if none selected
            if (!currentFamilyTreeId && trees.owned.length > 0) {
                setCurrentFamilyTreeId(trees.owned[0].id);
            } else if (!currentFamilyTreeId && trees.shared.length > 0) {
                setCurrentFamilyTreeId(trees.shared[0].id);
            }
        } catch (error) {
            console.error('Failed to fetch trees', error);
        }
    };

    const setCurrentFamilyTreeId = (id: string) => {
        localStorage.setItem('currentFamilyTreeId', id);
        setCurrentFamilyTreeIdState(id);
        // Dispatch event or just rely on react state update? 
        // Since api.ts reads from localStorage, we need to ensure it's updated. 
        // But react components will re-render if they use context.
        // If components use `useQuery` they might need invalidation.
        window.location.reload(); // Simple brute force to reload tree data? Or use queryClient invalidation if available? 
        // Ideally we should use queryClient.invalidateQueries(['people']) but we don't have access to queryClient here easily.
        // Reloading page is safe/simple for switching workspaces.
    };

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated: !!user,
            isLoading,
            login,
            register,
            logout,
            currentFamilyTree,
            setCurrentFamilyTreeId,
            familyTrees,
            refreshFamilyTrees
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
