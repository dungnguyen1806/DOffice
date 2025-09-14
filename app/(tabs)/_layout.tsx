import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs'; // Import types nếu cần type chặt chẽ hơn cho options/icons

// Hàm trợ giúp để lấy tên icon phù hợp cho từng platform
const getIconName = (name: keyof typeof Ionicons.glyphMap, focused: boolean): keyof typeof Ionicons.glyphMap => {
    // Đảm bảo trả về key hợp lệ của Ionicons.glyphMap
    const baseName = name.replace('-outline', '') as keyof typeof Ionicons.glyphMap; // Lấy tên gốc
    if (Platform.OS === 'ios') {
        return focused ? baseName : (`${baseName}-outline` as keyof typeof Ionicons.glyphMap);
    } else {
        return focused ? baseName : (`${baseName}-outline` as keyof typeof Ionicons.glyphMap); // Hoặc dùng một logic khác cho Android nếu muốn
    }
};

export default function TabLayout() {
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
                iconName = getIconName('list', focused);
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
            <Tabs.Screen
                name="history"
                options={{
                    title: 'Lịch sử',
                }}
            />
        </Tabs>
    );
}
