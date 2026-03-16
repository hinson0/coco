import { useState, useRef, useEffect } from "react";
import { TouchableOpacity, Text, StyleSheet, Animated } from "react-native";
import {
  useAudioRecorder,
  AudioModule,
  setAudioModeAsync,
  useAudioRecorderState,
  IOSOutputFormat,
  AudioQuality,
} from "expo-audio";
import * as FileSystem from "expo-file-system";

const WAV_PRESET = {
  extension: ".wav",
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 256000,
  android: { outputFormat: "default" as const, audioEncoder: "default" as const },
  ios: {
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.HIGH,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {},
};

interface Props {
  readonly onRecorded: (base64: string) => void;
  readonly disabled: boolean;
}

export function VoiceRecorder({ onRecorded, disabled }: Props) {
  const audioRecorder = useAudioRecorder(WAV_PRESET);
  const recorderState = useAudioRecorderState(audioRecorder);
  const [duration, setDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) return;
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    })();
  }, []);

  const startRecording = async () => {
    try {
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();

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
    if (timerRef.current) clearInterval(timerRef.current);
    scale.stopAnimation();
    scale.setValue(1);

    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;

      if (uri) {
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        onRecorded(base64);
      }
    } catch (err) {
      console.error("Stop recording failed:", err);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.btn, recorderState.isRecording && styles.btnRecording]}
      onPressIn={startRecording}
      onPressOut={stopRecording}
      disabled={disabled}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Text style={styles.icon}>
          {recorderState.isRecording ? `${duration}"` : "\uD83C\uDF99\uFE0F"}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#2D9B83", justifyContent: "center", alignItems: "center" },
  btnRecording: { backgroundColor: "#DC2626" },
  icon: { color: "#fff", fontSize: 16 },
});
