import React, { useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Audio } from "expo-av";

import CircleButton from "@/components/CircleButton";
import TextBox from "@/components/TextBox";

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "AIzaSyCX9gc40pdxln7jzbtc0RRlmHpQXNFlJ7s" });

export default function App() {
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [recordingUri, setRecordingUri] = useState<string | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const recordingRef = useRef<Audio.Recording | null>(null);
    const [transcribedText, setTranscribedText] = useState<string | null>(null);

    const startRecording = async () => {
        try {
            await Audio.requestPermissionsAsync();
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            recordingRef.current = recording;
            setRecording(recording);
            setIsRecording(true);
        } catch (err) {
            console.error("Failed to start recording", err);
        }
    };

    const stopRecording = async () => {
        if (!recordingRef.current) return;

        setIsRecording(false);
        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI();
        setRecordingUri(uri);
        setRecording(null);
    };

    const playRecording = async () => {
        if (!recordingUri) return;

        const { sound } = await Audio.Sound.createAsync({ uri: recordingUri });
        setSound(sound);
        await sound.playAsync();
    };

    const transcribe = async () => {
        if (!recordingUri) return;

        const prompt = "transcbrie this audio";

        const { text } = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [prompt, recordingUri],
        });

        setTranscribedText(text ?? null);
    };

    return (
        <View style={styles.container}>
            {/* {recording && <LiveAudioVisualizer mediaRecorder={recording} />} */}
            <View style={styles.optionsContainer}>
                {transcribedText && <TextBox content={transcribedText} />}
                <View style={styles.optionsRow}>
                    <CircleButton
                        icons="cw"
                        onPress={() => setRecordingUri(null)}
                    ></CircleButton>
                    <CircleButton
                        icons={isRecording ? "controller-stop" : "controller-play"}
                        onPress={isRecording ? stopRecording : startRecording}
                    >
                    </CircleButton>
                </View>
                {recordingUri && (
                    <View style={styles.optionsRow}>
                        <TouchableOpacity style={styles.button} onPress={playRecording}>
                            <Text style={styles.buttonText}>Play Recording</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.button} onPress={transcribe}>
                            <Text style={styles.buttonText}>Transcribe</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#25292e" },
    optionsContainer: { position: "absolute", bottom: 80 },
    optionsRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", paddingHorizontal: 20 },
    button: { padding: 15, borderRadius: 8, marginTop: 20, minWidth: 200, alignItems: "center", backgroundColor: "#ffd33d" },
    buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
