import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: "#ffd33d",
                headerStyle: {
                    backgroundColor: '#25292f',
                },
                headerShadowVisible: false,
                headerTintColor: '#fff',
                tabBarStyle: {
                    backgroundColor: '#25292f',
                },
            }}>
            <Tabs.Screen name="index" options={{
                title: "Home",
                tabBarIcon: ({ color, focused }) => (
                    <Ionicons name={focused ? "home-sharp" : "home-outline"} color={color} size={24} />
                ),
            }} />
            <Tabs.Screen name="image" options={{
                title: "Image",
                tabBarIcon: ({ color, focused }) => (
                    <Ionicons name={focused ? "image" : "image-outline"} color={color} size={24} />
                ),
            }} />
            <Tabs.Screen name="speech" options={{
                title: "Speech",
                tabBarIcon: ({ color, focused }) => (
                    <Ionicons name={focused ? "mic" : "mic-outline"} color={color} size={24} />
                ),
            }} />
            <Tabs.Screen name="settings" options={{
                title: "Settings",
                tabBarIcon: ({ color, focused }) => (
                    <Ionicons name={focused ? "settings" : "settings-outline"} color={color} size={24} />
                ),
            }} />
        </Tabs>
    );
}