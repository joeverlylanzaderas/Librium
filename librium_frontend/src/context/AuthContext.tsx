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
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signIn: (token: string, userData: User) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Restore session on app start ─────────────────────
  useEffect(() => {
    const restoreSession = async () => {
      try {
        await loadToken();

        const storedUser = await AsyncStorage.getItem('user');

        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (e) {
        console.log('Restore session error:', e);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  // ── Login ────────────────────────────────────────────
  const signIn = async (
    token: string,
    userData: User
  ) => {
    await setToken(token);

    await AsyncStorage.setItem(
      'user',
      JSON.stringify(userData)
    );

    setUser(userData);
  };

  // ── Logout ───────────────────────────────────────────
  const signOut = async () => {
    await clearToken();

    await AsyncStorage.removeItem('user');

    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext)!;