// app/_layout.tsx
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext'; // Import your provider and hook

// This hook will protect the route access based on authentication state.
const useProtectedRoute = () => {  
  const segments = useSegments();
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    // Don't run the effect until loading is complete
    if (isLoading) return;
    
    const inAuthGroup = String(segments[0]) === '(auth)';

    if (!user && !inAuthGroup) {
      // If the user is not signed in and the initial segment is not '(auth)',
      // redirect them to the login page.
      router.replace('/login' as any);
    } else if (user && inAuthGroup) {
      // If the user is signed in and the initial segment is '(auth)',
      // redirect them to the main app screen.
      router.replace('/ocr');
    }
  }, [user, isLoading, segments, router]);
};

// Main layout component
const RootLayoutNav = () => {
  useProtectedRoute(); // The gatekeeper hook

  return (
    <Stack>
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