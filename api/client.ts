// api/client.ts
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'my-jwt'; // The key to store the token under
const BACKEND_BASE_URL = 'https://doffice-backend.onrender.com/api/v1';

const api = axios.create({
  baseURL: BACKEND_BASE_URL, 
  headers: {
    'Content-Type': 'application/json',
  },
});

// Use an interceptor to attach the token to every request.
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Functions to manage the token in SecureStore and the API header
export const setAuthToken = async (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } else {
    delete api.defaults.headers.common['Authorization'];
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
};

export const signUpUser = (email: string, password: string) => {
  return api.post('/users/', { email, password });
};

export const loginUser = (email: string, password: string) => {
  const params = new URLSearchParams();
  params.append('username', email);
  params.append('password', password);
  return api.post('/auth/token', params);
}

export default api;