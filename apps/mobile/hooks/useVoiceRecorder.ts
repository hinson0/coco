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
  // useRef 镜像 isRecording，避免 useCallback/PanResponder 闭包捕获过期值
  const isRecordingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

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
    recorder.record();
    setRecordingFlag(true);

    // 60 秒自动停止
    timerRef.current = setTimeout(async () => {
      await recorder.stop();
      setRecordingFlag(false);
    }, MAX_DURATION_MS);

    return true;
  }, [recorder, clearTimer, setRecordingFlag]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    clearTimer();
    // 读 ref 而非 state，避免闭包过期
    if (!isRecordingRef.current) return null;

    await recorder.stop();
    setRecordingFlag(false);

    if (cancelledRef.current) return null;
    return readBase64();
  }, [recorder, clearTimer, setRecordingFlag, readBase64]);

  const cancelRecording = useCallback(async (): Promise<void> => {
    clearTimer();
    cancelledRef.current = true;
    if (isRecordingRef.current) {
      await recorder.stop();
      setRecordingFlag(false);
    }
  }, [recorder, clearTimer, setRecordingFlag]);

  return { isRecording, startRecording, stopRecording, cancelRecording };
}
