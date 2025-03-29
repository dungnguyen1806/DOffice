import { StyleSheet, useWindowDimensions } from 'react-native';
import { Image, type ImageSource, type ImageLoadEventData } from 'expo-image';
import { useState } from 'react';

type Props = {
    imgSource: ImageSource;
    selectedImage?: string;
};

export default function ImageViewer({ imgSource, selectedImage }: Props) {

    // const imageSource = selectedImage ? { uri: selectedImage } : imgSource;

    // return <Image source={imageSource} style={styles.image} />;

    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
    const { height: windowHeight } = useWindowDimensions();

    const imageSource = selectedImage ? { uri: selectedImage } : imgSource;

    const handleImageLoad = (event: ImageLoadEventData) => {
        const { width, height } = event.source;
        const aspectRatio = width / height;

        // Adjust the image size to fit within the screen width
        // const adjustedWidth = Math.min(windowWidth * 0.3, width);
        // const adjustedHeight = adjustedWidth / aspectRatio;

        const adjustedHeight = Math.min(windowHeight * 0.3, height);
        const adjustedWidth = adjustedHeight * aspectRatio;

        setImageSize({ width: adjustedWidth, height: adjustedHeight });
    }

    return (
        <Image
            source={imageSource}
            // style={styles.image}
            style={[styles.image, imageSize]}
            onLoad={handleImageLoad}
        />
    );
}

const styles = StyleSheet.create({
    image: {
        borderRadius: 18,
    },
});
