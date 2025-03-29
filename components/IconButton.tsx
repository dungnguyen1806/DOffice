import { Pressable, StyleSheet, Text } from "react-native";
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

type Props = {
    icons: keyof typeof MaterialIcons.glyphMap;
    label: string;
    onPress?: () => void;
}

export default function IconButton({ icons, label, onPress }: Props) {
    return (
        <Pressable style={styles.iconButton} onPress={onPress}>
            <MaterialIcons name={icons} size={24} color="#fff" />
            <Text style={styles.iconButtonLabel}>{label}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    iconButton: {
        justifyContent: "center",
        alignItems: "center",
    },
    iconButtonLabel: {
        color: "#fff",
        marginTop: 12,
    }
})