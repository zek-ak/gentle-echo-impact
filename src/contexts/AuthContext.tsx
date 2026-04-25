import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { getSession, clearSession } from '@/lib/auth';
import { initializeSupabaseClient } from '../lib/supabase/client.ts';

interface AuthContextType {
  user: any | null;
  roles: string[];
  loading: boolean;
  isLoggingOut: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  roles: [],
  loading: true,
  isLoggingOut: false,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (session) {
      setUser(session.user);
      setRoles([session.user.role || 'member']);
      // Initialize Supabase client with the token so RLS policies work
      initializeSupabaseClient();
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const handleStorageChange = () => {
      const session = getSession();
      if (session) {
        setUser(session.user);
        setRoles([session.user.role || 'member']);
      } else {
        setUser(null);
        setRoles([]);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const logout = useCallback(async () => {
    setIsLoggingOut(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    clearSession();
    setIsLoggingOut(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, roles, loading, isLoggingOut, logout }}>
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
