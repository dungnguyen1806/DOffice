// context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import api, { setAuthToken, loginUser, signUpUser } from '../api/client'; // Your API client
import * as SecureStore from 'expo-secure-store';

interface User {
  id: number;
  email: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // This effect runs on app startup to check for a stored token
    const loadUserFromStorage = async () => {
      const storedToken = await SecureStore.getItemAsync('my-jwt');
      if (storedToken) {
        setToken(storedToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        try {
          // Verify the token with the /users/me endpoint
          const response = await api.get('/users/me/');
          setUser(response.data);
        } catch (e) {
          // Token is invalid or expired
          await setAuthToken(null);
        }
      }
      setIsLoading(false);
    };

    loadUserFromStorage();
  }, []);

  const signIn = async (email: string, password: string) => {
    const response = await loginUser(email, password);
    const { access_token } = response.data;
    
    setToken(access_token);
    await setAuthToken(access_token);
    
    const userResponse = await api.get('/users/me/');
    setUser(userResponse.data);
  };

  const signUp = async (email: string, password: string) => {
    // 1. Call the backend to create the new user account.
    await signUpUser(email, password);
    
    // 2. If the signup was successful (it didn't throw an error),
    //    immediately log the new user in to create a session.
    await signIn(email, password);
  };

  const signOut = async () => {
    setUser(null);
    setToken(null);
    await setAuthToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to easily access the context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 