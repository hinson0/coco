import { useState, useRef } from "react";
import { TouchableOpacity, Text, StyleSheet, Animated } from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";

interface Props {
  readonly onRecorded: (base64: string) => void;
  readonly disabled: boolean;
}

export function VoiceRecorder({ onRecorded, disabled }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scale = useRef(new Animated.Value(1)).current;

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") return;

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        android: { extension: ".wav", sampleRate: 16000, numberOfChannels: 1, bitRate: 256000, outputFormat: Audio.AndroidOutputFormat.DEFAULT, audioEncoder: Audio.AndroidAudioEncoder.DEFAULT },
        ios: { extension: ".wav", sampleRate: 16000, numberOfChannels: 1, bitRate: 256000, outputFormat: Audio.IOSOutputFormat.LINEARPCM, audioQuality: Audio.IOSAudioQuality.HIGH, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
        web: {},
      });
      await recording.startAsync();

      recordingRef.current = recording;
      setIsRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);

      Animated.loop(
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.3, duration: 500, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } catch (err) {
      console.error("Recording failed:", err);
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;

    if (timerRef.current) clearInterval(timerRef.current);
    scale.stopAnimation();
    scale.setValue(1);
    setIsRecording(false);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (uri) {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        onRecorded(base64);
      }
    } catch (err) {
      console.error("Stop recording failed:", err);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.btn, isRecording && styles.btnRecording]}
      onPressIn={startRecording}
      onPressOut={stopRecording}
      disabled={disabled}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Text style={styles.icon}>{isRecording ? `${duration}"` : "🎙️"}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#6366f1", justifyContent: "center", alignItems: "center" },
  btnRecording: { backgroundColor: "#ef4444" },
  icon: { color: "#fff", fontSize: 16 },
});
