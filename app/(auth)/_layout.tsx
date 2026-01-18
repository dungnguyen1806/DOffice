// app/(auth)/_layout.tsx
import { Stack } from 'expo-router';
import React from 'react';

export default function AuthLayout() {
  return (
    // The Stack component will provide the navigation container.
    <Stack>
      {/* 
        By default, Expo Router creates a stack screen for each file in the directory.
        Here, we can configure options for the entire stack.
      */}
      <Stack.Screen
        name="Đăng nhập" // This refers to login.tsx
        options={{
          headerShown: true, 
        }}
      />
      <Stack.Screen
        name="Đăng ký" // This refers to signup.tsx
        options={{
          headerShown: true, 
        }}
      />
    </Stack>
  );
}