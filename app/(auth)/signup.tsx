// app/(auth)/signup.tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { signUp } = useAuth();
  const router = useRouter();

  const handleSignUp = async () => {
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setError('');
    setLoading(true);

    try {
      await signUp(email, password);
      // The useProtectedRoute hook in the layout will handle the redirect automatically.
    } catch (err: any) {
      // The backend returns a 400 error if the email already exists.
      const detail = err.response?.data?.detail || 'An unexpected error occurred.';
      setError(detail);
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />
      
      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <Button title="Sign Up" onPress={handleSignUp} />
      )}
      
      <Pressable onPress={() => router.push('/login')} style={styles.link}>
        <Text>Already have an account? Sign In</Text>
      </Pressable>
    </View>
  );
}

// Add some basic styling
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  input: { borderWidth: 1, borderColor: 'gray', padding: 10, marginVertical: 10, borderRadius: 5 },
  errorText: { color: 'red', textAlign: 'center', marginBottom: 10 },
  link: { marginTop: 15, alignItems: 'center' },
});