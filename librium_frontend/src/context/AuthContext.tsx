import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  setToken,
  clearToken,
  loadToken,
} from '../services/api';

type User = {
  id: number;
  email: string;
  full_name?: string;
  role?: string;
  profile_picture?: string | null;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signIn: (token: string, userData: User) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: (updates: Partial<User>) => Promise<void>;  
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        await loadToken();
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) setUser(JSON.parse(storedUser));
      } catch (e) {
      } finally {
        setLoading(false);
      }
    };
    restoreSession();
  }, []);

  const signIn = async (token: string, userData: User) => {
    await setToken(token);
    await AsyncStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const signOut = async () => {
    await clearToken();
    await AsyncStorage.removeItem('user');
    setUser(null);
  };

  // ── Merge partial updates into the stored user ───────
  const refreshUser = async (updates: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      AsyncStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext)!;