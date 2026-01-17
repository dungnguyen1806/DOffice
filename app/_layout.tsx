// app/_layout.tsx

import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';

const useProtectedRoute = () => {  
  const segments = useSegments();
  const router = useRouter();
  const { user, isGuest, isLoading } = useAuth(); // <-- Get isGuest state

  useEffect(() => {
    if (isLoading) return;
    
    const inTabsGroup = segments[0] === '(tabs)';

    // Check if the user is in any of the routes that are NOT the entry screen (index).
    const isPublicRoute = !inTabsGroup;;

    if (!user && !isGuest && !isPublicRoute) {
      // If not logged in AND not a guest, and trying to access the app,
      // redirect to the main welcome screen (index).
      router.replace('/');
    } else if ((user || isGuest) && isPublicRoute) {
      // If logged in OR a guest, but currently on the index page,
      // send them into the app.
      router.replace('/ocr');
    }
  }, [user, isGuest, isLoading, segments, router]);
};

const RootLayoutNav = () => {
  useProtectedRoute();
  
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
    </Stack>
  );
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}