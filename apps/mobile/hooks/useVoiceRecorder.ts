import { useRef, useCallback, useState } from 'react';
import { Alert, Linking } from 'react-native';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

const MAX_DURATION_MS = 60_000;

export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [metering, setMetering] = useState(0); // 0~1 归一化音量
  // useRef 镜像 isRecording，避免 useCallback/PanResponder 闭包捕获过期值
  const isRecordingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meteringTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);
  const startTimeRef = useRef<number>(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (meteringTimerRef.current) {
      clearInterval(meteringTimerRef.current);
      meteringTimerRef.current = null;
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
      Alert.alert(
        '需要麦克风权限',
        '请在系统设置中允许 Coco 访问麦克风',
        [
          { text: '取消', style: 'cancel' },
          { text: '去设置', onPress: () => Linking.openSettings() },
        ],
      );
      return false;
    }

    clearTimer();
    cancelledRef.current = false;
    await recorder.prepareToRecordAsync();
    startTimeRef.current = Date.now();
    recorder.record();
    setRecordingFlag(true);

    // 音量轮询（100ms 间隔，读取 currentMetering dB 值并归一化到 0~1）
    meteringTimerRef.current = setInterval(() => {
      const db = (recorder as any).currentMetering ?? -160;
      // dB 范围大约 -160 ~ 0，归一化到 0 ~ 1
      const normalized = Math.max(0, Math.min(1, (db + 60) / 60));
      setMetering(normalized);
    }, 100);

    // 60 秒自动停止
    timerRef.current = setTimeout(async () => {
      await recorder.stop();
      setRecordingFlag(false);
    }, MAX_DURATION_MS);

    return true;
  }, [recorder, clearTimer, setRecordingFlag]);

  const stopRecording = useCallback(async (): Promise<{ base64: string; durationSeconds: number } | null> => {
    clearTimer();
    // 读 ref 而非 state，避免闭包过期
    if (!isRecordingRef.current) return null;

    const durationSeconds = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
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

  return { isRecording, metering, startRecording, stopRecording, cancelRecording };
}
