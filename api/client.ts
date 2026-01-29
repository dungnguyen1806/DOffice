// api/client.ts
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const TOKEN_KEY = 'my-jwt'; // The key to store the token under

const ENV_API_URL = process.env.EXPO_PUBLIC_API_URL;
const ENV_WS_URL = process.env.EXPO_PUBLIC_WS_URL;

if (!ENV_API_URL) {
    console.warn("WARNING: EXPO_PUBLIC_API_URL is not defined. Falling back to localhost (will not work on device).");
}

export const BACKEND_HTTP_URL = ENV_API_URL || 'http://localhost:8000/api/v1';
export const BACKEND_WS_URL = ENV_WS_URL || 'ws://localhost:8000/api/v1';

console.log(`Using Backend: ${BACKEND_HTTP_URL}`);

const api = axios.create({
  baseURL: BACKEND_HTTP_URL, 
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


// JOB UPLOAD FUNCTION
export const submitJob = (fileUri: string) => {
    const formData = new FormData();
    const filename = fileUri.split('/').pop() || `upload.tmp`;
    const match = /\.(\w+)$/.exec(filename || '');
    // Simple mimetype detection, can be improved if needed
    let fileType = 'application/octet-stream';
    if (fileUri.startsWith('file://')) {
        const extension = match ? match[1].toLowerCase() : '';
        if (['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
            fileType = `image/${extension}`;
        } else if (['m4a', 'mp3', 'wav', 'ogg', 'flac'].includes(extension)) {
            fileType = `audio/${extension}`;
        }
    }

    formData.append('file', {
        uri: fileUri,
        name: filename,
        type: fileType,
    } as any);

    // Use the api instance so the auth token is automatically attached
    return api.post('/submit', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
};

export const updateJobText = (jobId: number, newText: string) => {
    return api.patch(`/transcriptions/${jobId}`, {
        transcribed_text: newText
    });
};

export const deleteJob = (jobId: number) => {
    return api.delete(`/transcriptions/${jobId}`);
};

// AUTH FUNCTIONS
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
  return api.post('/users', { email, password });
};

export const loginUser = (email: string, password: string) => {
  const formData = new URLSearchParams();
  formData.append('username', email);
  formData.append('password', password);
  return api.post('/auth/token', formData.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
}

export const loginWithGoogle = (idToken: string) => {
  return api.post('/auth/google', { id_token: idToken });
};


// HISTORY FUNCTION
export const getHistory = (skip: number = 0, limit: number = 20) => {
  return api.get('/transcriptions', {
    params: {
      skip,
      limit,
    },
  });
};

export default api;