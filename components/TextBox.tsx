import { StyleSheet, ScrollView, Text } from "react-native";

type Props = {
    content: string;
}

export default function TextBox({ content }: Props) {
    return (
        <ScrollView style={styles.scrollBox}>
            <Text style={styles.text}>{content}</Text>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollBox: {
        width: "90%",
        height: 200,
        backgroundColor: "white",
        borderRadius: 8,
        padding: 10,
    },
    text: {
        fontSize: 16,
        color: "#333",
    }
})