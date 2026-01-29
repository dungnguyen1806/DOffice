// app/(auth)/login.tsx
import { useState, useEffect } from 'react';
import { View, TextInput, Button, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
// import * as Google from 'expo-auth-session/providers/google';
// import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router'; // Import useRouter

// WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { signIn, googleSignIn } = useAuth();
  const router = useRouter(); // Initialize the router

//   const [request, response, promptAsync] = Google.useAuthRequest({
//     // Use the CLIENT IDs you created in Google Console
//     androidClientId: "YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com",
//     iosClientId: "YOUR_IOS_CLIENT_ID.apps.googleusercontent.com",
//     webClientId: "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com",
//   });
  
//   useEffect(() => {
//     handleGoogleResponse();
//   }, [response]);

//   const handleGoogleResponse = async () => {
//     if (response?.type === 'success') {
//       const { authentication } = response;
//         // Use id_token (if available) or access_token to get id_token
//         // Usually Google returns an id_token in the authentication object
//       if (authentication?.idToken) {
//           try {
//               await googleSignIn(authentication.idToken);
//               // ProtectedRoute hook in layout will handle redirect
//           } catch (e) {
//               Alert.alert("Lỗi", "Đăng nhập Google thất bại phía máy chủ.");
//           }
//       } else {
//             // Sometimes we only get accessToken, we might need to fetch user info manually
//             // or configure responseType to include id_token
//             Alert.alert("Lỗi", "Không nhận được ID Token từ Google.");
//       }
//   }
// };

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      // The useProtectedRoute hook in the root layout will handle redirection
    } catch (err: any) {
      console.log("Error response:", err.response?.data);

      let errorMessage = 'Lỗi không xác định.';

      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;

        if (Array.isArray(detail)) {
          // CASE 1: Pydantic Validation Error (Array of objects)
          // We join the messages together or just show the first one
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
      <Text style={styles.title}>Chào mừng bạn đến với DOffice!</Text>

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
      
      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <Button title="Đăng nhập" onPress={handleLogin} />
      )}
      
      <Pressable onPress={() => router.push('/signup')} style={styles.link}>
        <Text style={styles.linkText}>Không có tài khoản? Đăng ký tại đây</Text>
      </Pressable>

      {/* <Text style={styles.linkText}>Hoặc</Text>

            <Ionicons.Button
                name="logo-google"
                backgroundColor="#DB4437"
                onPress={() => {
                    promptAsync();
                }}
                disabled={!request}
            >
                Đăng nhập với Google
            </Ionicons.Button> */}
    </View>
  );
}

// Use the same styles as your signup screen for consistency
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  input: { borderWidth: 1, borderColor: 'gray', padding: 10, marginVertical: 10, borderRadius: 5 },
  errorText: { color: 'red', textAlign: 'center', marginBottom: 10 },
  link: { marginTop: 15, alignItems: 'center' },
  linkText: { color: '#007AFF' } // Style for the link text
});