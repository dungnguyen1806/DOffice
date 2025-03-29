import { View, Pressable, StyleSheet } from 'react-native';
import Entypo from '@expo/vector-icons/Entypo';

type Props = {
    icons: keyof typeof Entypo.glyphMap;
    onPress: () => void;
};

export default function CircleButton({ icons, onPress }: Props) {
    return (
        <View style={styles.circleButtonContainer}>
            <Pressable style={styles.circleButton} onPress={onPress}>
                <Entypo name={icons} size={38} color="#25292e" />
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    circleButtonContainer: {
        width: 84,
        height: 84,
        marginHorizontal: 60,
        borderWidth: 4,
        borderColor: '#ffd33d',
        borderRadius: 42,
        padding: 3,
    },
    circleButton: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 42,
        backgroundColor: '#fff',
    },
});