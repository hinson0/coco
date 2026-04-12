import { useRef, useCallback, useState, useEffect } from "react";
import { Alert, Linking } from "react-native";
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";

const MAX_DURATION_MS = 60_000;

// 在 HIGH_QUALITY 基础上启用 metering
const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
};

export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const [isRecording, setIsRecording] = useState(false);
  const [metering, setMetering] = useState(0); // 0~1 归一化音量

  // 录音期间轮询 metering（通过 useEffect 避免闭包问题）
  const recorderRef = useRef(recorder);
  recorderRef.current = recorder;
  // 录音期间轮询 metering
  useEffect(() => {
    if (!isRecording) {
      setMetering(0);
      return;
    }
    const id = setInterval(() => {
      try {
        const status = recorderRef.current.getStatus();
        const db = status.metering ?? -160;
        const normalized = Math.max(0, Math.min(1, (db + 60) / 60));
        setMetering(normalized);
      } catch {
        // recorder 可能已释放
      }
    }, 100);
    return () => clearInterval(id);
  }, [isRecording]);

  // useRef 镜像 isRecording，避免 useCallback/PanResponder 闭包捕获过期值
  const isRecordingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  const startTimeRef = useRef<number>(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const setRecordingFlag = useCallback((value: boolean) => {
    isRecordingRef.current = value;
    setIsRecording(value);
  }, []);

  const readBase64 = useCallback(async (): Promise<string | null> => {
    const uri = recorder.uri;
    if (!uri) return null;
    return FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }, [recorder]);

  const startRecording = useCallback(async (): Promise<boolean> => {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      Alert.alert("需要麦克风权限", "请在系统设置中允许 Coco 访问麦克风", [
        { text: "取消", style: "cancel" },
        { text: "去设置", onPress: () => Linking.openSettings() },
      ]);
      return false;
    }

    clearTimer();
    cancelledRef.current = false;
    await recorder.prepareToRecordAsync();
    startTimeRef.current = Date.now();
    recorder.record();
    setRecordingFlag(true);

    // 60 秒自动停止
    timerRef.current = setTimeout(async () => {
      await recorder.stop();
      setRecordingFlag(false);
    }, MAX_DURATION_MS);

    return true;
  }, [recorder, clearTimer, setRecordingFlag]);

  const stopRecording = useCallback(async (): Promise<{
    base64: string;
    durationSeconds: number;
  } | null> => {
    clearTimer();
    // 读 ref 而非 state，避免闭包过期
    if (!isRecordingRef.current) return null;

    const durationSeconds = Math.max(
      1,
      Math.round((Date.now() - startTimeRef.current) / 1000),
    );
    await recorder.stop();
    setRecordingFlag(false);

    if (cancelledRef.current) return null;
    const base64 = await readBase64();
    if (!base64) return null;
    return { base64, durationSeconds };
  }, [recorder, clearTimer, setRecordingFlag, readBase64]);

  const cancelRecording = useCallback(async (): Promise<void> => {
    clearTimer();
    cancelledRef.current = true;
    if (isRecordingRef.current) {
      await recorder.stop();
      setRecordingFlag(false);
    }
  }, [recorder, clearTimer, setRecordingFlag]);

  return {
    isRecording,
    metering,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
