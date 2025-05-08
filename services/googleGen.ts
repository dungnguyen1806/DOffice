import { Platform } from "react-native";
import { GoogleGenAI } from "@google/genai";
import * as FileSystem from "expo-file-system";

const ai = new GoogleGenAI({ apiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY });
export default ai;

interface inlineData {
    data: string;
    mimeType: string;
}
/**
 * convert file path to generative part that can be feed to google model
 * @param path 
 * @param mimeType 
 * @returns 
 */
export async function fileToGenerativePart(path: string, mimeType: string): Promise<{ inlineData: inlineData }> {
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
