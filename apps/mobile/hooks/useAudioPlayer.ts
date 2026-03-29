import { useRef, useCallback, useState } from 'react';
import { createAudioPlayer } from 'expo-audio';

export function useAudioPlayer() {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
    if (playerRef.current) {
      playerRef.current.remove();
      playerRef.current = null;
    }
  }, []);

  const play = useCallback((messageId: string, uri: string) => {
    if (playingId === messageId) {
      // 点击正在播放的 → 停止
      cleanup();
      setPlayingId(null);
      return;
    }

    // 停止旧的
    cleanup();

    // 播放新的
    const player = createAudioPlayer({ uri });
    playerRef.current = player;
    player.play();
    setPlayingId(messageId);

    // 播放结束后清除状态
    checkIntervalRef.current = setInterval(() => {
      if (player.currentTime >= player.duration && player.duration > 0) {
        cleanup();
        setPlayingId(null);
      }
    }, 300);
  }, [playingId, cleanup]);

  const stop = useCallback(() => {
    cleanup();
    setPlayingId(null);
  }, [cleanup]);

  return { playingId, play, stop };
}
