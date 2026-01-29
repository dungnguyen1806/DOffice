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
      setError("Mật khẩu không đúng");
      return;
    }
    setError('');
    setLoading(true);

    try {
      await signUp(email, password);
      // The useProtectedRoute hook will handle the redirect.
    } catch (err: any) {
      console.log("Error response:", err.response?.data);

      let errorMessage = 'Lỗi không xác định.';

      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;

        if (Array.isArray(detail)) {
          // CASE 1: Pydantic Validation Error (Array of objects)
          errorMessage = detail.map((item: any) => item.msg).join('\n');
        } else if (typeof detail === 'string') {
          // CASE 2: Standard HTTPException (String)
          errorMessage = detail;
        } else {
          // CASE 3: Unknown object structure
          errorMessage = JSON.stringify(detail);
        }
      } else if (err.message) {
         // Network errors or other axios errors
         errorMessage = err.message;
      }

      setError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tạo tài khoản</Text>

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
        placeholder="Mật khẩu"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TextInput
        style={styles.input}
        placeholder="Nhập lại mật khẩu"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />
      
      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <Button title="Đăng ký" onPress={handleSignUp} />
      )}
      
      <Pressable onPress={() => router.push('/login')} style={styles.link}>
        <Text style={styles.linkText}>Đã có tài khoản? Đăng nhập tại đây</Text>
      </Pressable>
    </View>
  );
}

// --- Updated Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  input: { borderWidth: 1, borderColor: 'gray', padding: 10, marginVertical: 10, borderRadius: 5 },
  errorText: { color: 'red', textAlign: 'center', marginBottom: 10 },
  link: { marginTop: 15, alignItems: 'center' },
  linkText: { color: '#007AFF' }
});