import { View, StyleSheet, Platform } from "react-native";
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useState } from "react";

import ImageViewer from "@/components/ImageViewer";
import Button from "@/components/Button";
import TextBox from "@/components/TextBox";

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY });

async function fileToGenerativePart(path: string, mimeType: string): Promise<{ inlineData: { data: string; mimeType: string } }> {
    if (Platform.OS === 'web') {
        const file = await fetch(path);
        const blob = await file.blob();

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                resolve({
                    inlineData: {
                        data: reader.result ? reader.result.toString().split(",")[1] ?? "" : "",
                        mimeType
                    },
                });
            };
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(blob);
        });
    }
    else {
        const base64Data = await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.Base64 });
        return {
            inlineData: {
                data: base64Data,
                mimeType
            },
        };
    }
}


export default function ImageScreen() {
    const [selectedImage, setSelectedImage] = useState<string | undefined>(undefined);
    const [transcribedText, setTranscribedText] = useState<string | null>(null);

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 1,
        });

        if (!result.canceled) {
            setSelectedImage(result.assets[0].uri);
        } else {
            alert('You cancelled the image picker.');
        }
    };

    const OCR = async () => {
        if (!selectedImage) return;

        const imagePart = await fileToGenerativePart(selectedImage, "image/jpeg");
        const prompt = "Give me the text content of this image.";

        const { text } = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [prompt, imagePart],
        });

        setTranscribedText(text ?? null);
    }

    return (
        <View style={styles.container}>
            <View style={styles.imageContainer}>
                <ImageViewer
                    imgSource={{ uri: "https://images.pexels.com/photos/674010/pexels-photo-674010.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1" }} selectedImage={selectedImage}
                />
            </View>
            {transcribedText && (<TextBox content={transcribedText} />
            )}
            <View style={styles.footerContainer}>
                <Button theme='primary' label="Choose a photo" onPress={pickImage} />
                {selectedImage && (<Button theme='translate' label="Transcribe" onPress={OCR} />)}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#25292e',
        alignItems: 'center',
    },
    imageContainer: {
        flex: 1,
    },
    footerContainer: {
        flex: 1 / 2,
        alignItems: 'center',
    },
});