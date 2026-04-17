import { useCallback, useEffect, useRef, useState } from "react";
import { createAudioPlayer } from "expo-audio";

export function useAudioPlayer() {
  const [playingId, setPlayingId] = useState<string | null>(null);
  // 镜像 state，避免 useCallback 闭包捕获过期 playingId 导致连点重复创建 player
  const playingIdRef = useRef<string | null>(null);
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const subscriptionRef = useRef<{ remove: () => void } | null>(null);

  const cleanup = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
    if (playerRef.current) {
      // remove() 仅释放对象，不停止 native 音频流，必须先 pause
      if (playerRef.current.playing) {
        playerRef.current.pause();
      }
      playerRef.current.remove();
      playerRef.current = null;
    }
  }, []);

  const setPlaying = useCallback((id: string | null) => {
    playingIdRef.current = id;
    setPlayingId(id);
  }, []);

  const play = useCallback(
    (messageId: string, uri: string) => {
      if (playingIdRef.current === messageId) {
        cleanup();
        setPlaying(null);
        return;
      }

      cleanup();

      const player = createAudioPlayer({ uri });
      playerRef.current = player;
      subscriptionRef.current = player.addListener(
        "playbackStatusUpdate",
        (status) => {
          if (status.didJustFinish) {
            cleanup();
            setPlaying(null);
          }
        },
      );
      player.play();
      setPlaying(messageId);
    },
    [cleanup, setPlaying],
  );

  useEffect(() => cleanup, [cleanup]);

  return { playingId, play };
}
