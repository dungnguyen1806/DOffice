// context/AuthContext.tsx

import { ReactNode, createContext, useContext, useState, useEffect } from 'react';
import api, { setAuthToken, loginUser, signUpUser, loginWithGoogle } from '../api/client';
import * as SecureStore from 'expo-secure-store';

interface User {
  id: number;
  email: string;
}

interface AuthContextType {
  user: User | null;
  isGuest: boolean; // <-- NEW: To track guest mode
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  googleSignIn: (idToken: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  enterGuestMode: () => void; // <-- NEW: Function to enter guest mode
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(false); // <-- NEW STATE
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUserFromStorage = async () => {
      const storedToken = await SecureStore.getItemAsync('my-jwt');
      if (storedToken) {
        api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        try {
          const response = await api.get('/users/me');
          setUser(response.data);
        } catch (e) {
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
    
    await setAuthToken(access_token);
    
    const userResponse = await api.get('/users/me');
    setUser(userResponse.data);
    setIsGuest(false); // Ensure guest mode is off after signing in
  };

  const googleSignIn = async (idToken: string) => {
    try {
      const response = await loginWithGoogle(idToken);
      const { access_token } = response.data;
      
      await setAuthToken(access_token);
      
      const userResponse = await api.get('/users/me');
      setUser(userResponse.data);
      setIsGuest(false);
    } catch (error) {
      console.error("Google Backend Auth Failed:", error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string) => {
    await signUpUser(email, password);
    await signIn(email, password);
  };

  const signOut = async () => {
    setUser(null);
    setIsGuest(false); // Also exit guest mode on sign out
    await setAuthToken(null);
  };

  const enterGuestMode = () => {
    setUser(null); // Ensure no user is set
    setIsGuest(true);
  };

  return (
    <AuthContext.Provider value={{ user, isGuest, isLoading, signIn, googleSignIn, signUp, signOut, enterGuestMode }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};