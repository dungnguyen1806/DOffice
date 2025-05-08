import { View, StyleSheet } from "react-native";
import { Link, Stack } from "expo-router";

export default function NotFound() {
    return (
        <View style={styles.container}>
            <Stack.Screen name="not-found" options={{ title: "Oops, not found" }} />
            <Link href={{ pathname: "/(tabs)/new_ocr" }} style={styles.text}>Go to home screen</Link>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#25292e',
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        color: '#fff',
        fontSize: 20,
        textDecorationLine: 'underline',
    },
});