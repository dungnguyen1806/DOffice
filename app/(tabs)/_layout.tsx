import React from 'react';
import { Tabs, Router, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../../context/AuthContext'

import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs'; // Import types nếu cần type chặt chẽ hơn cho options/icons

// Hàm trợ giúp để lấy tên icon phù hợp cho từng platform
const getIconName = (name: keyof typeof Ionicons.glyphMap, focused: boolean): keyof typeof Ionicons.glyphMap => {
    // Đảm bảo trả về key hợp lệ của Ionicons.glyphMap
    const baseName = name.replace('-outline', '') as keyof typeof Ionicons.glyphMap; 
    if (Platform.OS === 'ios') {
        return focused ? baseName : (`${baseName}-outline` as keyof typeof Ionicons.glyphMap);
    } else {
        return focused ? baseName : (`${baseName}-outline` as keyof typeof Ionicons.glyphMap); 
    }
};

export default function TabLayout() {
    const { user, signOut } = useAuth();
    const router = useRouter();

    const handleLogout = () => {
        Alert.alert(
            "Đăng xuất",
            `Bạn đang đăng nhập với tài khoản:\n${user?.email}\n\nBạn có muốn đăng xuất không?`,
            [
                { text: "Hủy", style: "cancel" },
                { 
                    text: "Đăng xuất", 
                    style: "destructive", 
                    onPress: () => {
                        signOut();
                        // Optional: Redirect to OCR or Login after logout
                        router.replace('/ocr');
                    } 
                }
            ]
        );
    };

    const screenOptions: BottomTabNavigationOptions | ((props: {
        route: any; // Type 'any' cho route vì type từ expo-router có thể phức tạp
        navigation: any;
    }) => BottomTabNavigationOptions) = ({ route }) => ({
        initialRouteName: 'ocr',
        tabBarActiveTintColor: '#1E90FF',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
            // Style nếu cần
        },
        tabBarIcon: ({ focused, color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap = 'alert-circle'; // Default icon

            if (route.name === 'ocr') {
                iconName = getIconName('camera', focused);
            } else if (route.name === 'speech') {
                iconName = getIconName('mic', focused);
            } else if (route.name === 'history') {
                iconName = user ? getIconName('list', focused) : getIconName('lock-closed-outline', focused);
            }

            return <Ionicons name={iconName} size={size} color={color} />;
        },
        headerStyle: {
            // backgroundColor: '#f8f8f8',
        },
        headerTintColor: '#333',
        headerTitleStyle: {
            // fontWeight: 'bold',
        },
    });


    return (
        <Tabs screenOptions={screenOptions}>
            <Tabs.Screen
                name="ocr"
                options={{
                    title: 'Nhận diện Ảnh',
                }}
            />
            <Tabs.Screen
                name='speech'
                options={{
                    title: 'Nhận diện Âm thanh',
                }}
            />
            {(
                <Tabs.Screen
                    name="history"
                    options={{
                        title: user ? 'Lịch sử' : 'Tài khoản',
                        headerRight: user ? () => (
                            <TouchableOpacity onPress={handleLogout} style={{ marginRight: 15 }}>
                                <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
                            </TouchableOpacity>
                        ) : undefined,
                    }}
                />
            )}
        </Tabs>
    );
}
