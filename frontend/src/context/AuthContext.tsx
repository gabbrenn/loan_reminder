import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

interface User {
  id: string;
  email: string;
  role: 'ADMIN' | 'LOAN_OFFICER' | 'CREDIT_MANAGER' | 'BORROWER';
  name: string;
}


interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (credentials: any) => Promise<void>;
  logout: () => void;
  loading: boolean;
  updateProfile: (data: { email?: string; name?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('jwt_token'));
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const decodeToken = (jwtToken: string): User | null => {
    try {
      const base64Url = jwtToken.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        window
          .atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (token) {
      const decoded = decodeToken(token);
      if (decoded) {
        setUser(decoded);
      } else {
        localStorage.removeItem('jwt_token');
        setToken(null);
        setUser(null);
      }
    }
    setLoading(false);
  }, [token]);

  const login = async (credentials: any) => {
    const res = await api.auth.login(credentials);
    const jwtToken = res.token;
    localStorage.setItem('jwt_token', jwtToken);
    setToken(jwtToken);
    const decoded = decodeToken(jwtToken);
    setUser(decoded);
  };

  const logout = () => {
    localStorage.removeItem('jwt_token');
    setToken(null);
    setUser(null);
  };

  const updateProfile = async (data: { email?: string; name?: string }) => {
    const res = await api.auth.updateProfile(data);
    const jwtToken = res.token;
    localStorage.setItem('jwt_token', jwtToken);
    setToken(jwtToken);
    const decoded = decodeToken(jwtToken);
    setUser(decoded);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
