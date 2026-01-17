// app/index.tsx

import React from 'react';
import { View, Text, StyleSheet, Button, SafeAreaView, Platform, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext'; // <-- Import useAuth

export default function WelcomeScreen(): React.JSX.Element {
    const router = useRouter();
    const { enterGuestMode } = useAuth(); // <-- Get the new function from context

    // Navigate to the authentication flow
    const navigateToAuth = () => {
        router.push('/login'); // Assuming you have an (auth)/login.tsx file
    };

    // Enter guest mode and navigate to the main app
    const navigateAsGuest = () => {
        enterGuestMode();
        router.replace('/ocr'); // Go to the main app as a guest
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <Ionicons
                    name={'scan-circle-outline'}
                    size={70}
                    color="#1E90FF"
                    style={styles.icon}
                />
                <Text style={styles.title}>Trình Chuyển Đổi Thông Minh</Text>
                <Text style={styles.description}>
                    Biến hình ảnh và giọng nói thành văn bản.
                    Đăng nhập để lưu trữ và quản lý lịch sử.
                </Text>

                {/* --- NEW BUTTONS --- */}
                <View style={styles.actionContainer}>
                    <TouchableOpacity style={styles.primaryButton} onPress={navigateToAuth}>
                        <Text style={styles.primaryButtonText}>Đăng nhập / Đăng ký</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.secondaryButton} onPress={navigateAsGuest}>
                        <Text style={styles.secondaryButtonText}>Tiếp tục với tư cách Khách</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

// --- Styles (Updated) ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#ffffff' },
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 25,
    },
    icon: { marginBottom: 25 },
    title: {
        fontSize: 26,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 15,
        color: '#2c3e50',
    },
    description: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 40,
        color: '#555',
        lineHeight: 24,
    },
    actionContainer: {
        width: '90%',
    },
    primaryButton: {
        backgroundColor: '#1E90FF',
        paddingVertical: 15,
        borderRadius: 25,
        alignItems: 'center',
        marginBottom: 15,
        elevation: 3,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    secondaryButton: {
        backgroundColor: '#f0f0f0',
        paddingVertical: 15,
        borderRadius: 25,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd'
    },
    secondaryButtonText: {
        color: '#333',
        fontSize: 16,
        fontWeight: '500',
    },
});