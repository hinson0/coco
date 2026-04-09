import type { ChatMessage, Transaction } from "@coco/shared";
import * as FileSystem from "expo-file-system/legacy";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChatBubble } from "../components/chat/ChatBubble";
import type { RecordingState } from "../components/chat/ChatInputBar";
import { ChatInputBar } from "../components/chat/ChatInputBar";
import { ChatToolBar } from "../components/chat/ChatToolBar";
import { TypingIndicator } from "../components/chat/TypingIndicator";
import { VoiceRecordingOverlay } from "../components/chat/VoiceRecordingOverlay";
import { colors, radii, shadows, spacing } from "../constants/theme";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { useCamera } from "../hooks/useCamera";
import { useChat } from "../hooks/useChat";
import { useLocalCategories } from "../hooks/useLocalCategories";
import {
  useClearChatMessages,
  useDeleteChatMessage,
  useLocalChatMessages,
} from "../hooks/useLocalChatMessages";

// ─── Types ────────────────────────────────────────────────────────────────────

type ListItem =
  | { type: "message"; data: ChatMessage }
  | { type: "separator"; id: string; label: string }
  | { type: "typing"; id: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateLabel(isoString: string): string {
  const d = new Date(isoString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86_400_000);
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (target.getTime() === today.getTime()) return "今天";
  if (target.getTime() === yesterday.getTime()) return "昨天";
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function buildListItems(
  messages: readonly ChatMessage[],
  isLoading: boolean,
): ListItem[] {
  const items: ListItem[] = [];
  let lastDateLabel = "";

  for (const msg of messages) {
    const label = toDateLabel(msg.created_at);
    if (label !== lastDateLabel) {
      items.push({ type: "separator", id: `sep-${msg.id}`, label });
      lastDateLabel = label;
    }
    items.push({ type: "message", data: msg });
  }

  if (isLoading) {
    items.push({ type: "typing", id: "typing-indicator" });
  }

  return items.reverse();
}

function itemKey(item: ListItem): string {
  if (item.type === "message") return item.data.id;
  if (item.type === "separator") return item.id;
  return item.id;
}

// ─── Welcome message ──────────────────────────────────────────────────────────

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  user_id: "",
  role: "assistant",
  content_type: "text",
  content: "早上好呀~ 支持文字、语音、拍小票三种方式记账，随时告诉我就好 😊",
  transaction_id: null,
  created_at: new Date().toISOString(),
};

// ─── Animated pulse dot ───────────────────────────────────────────────────────

function PulseDot() {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.4, { duration: 700 }),
        withTiming(1, { duration: 700 }),
      ),
      -1,
      false,
    );
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={[styles.statusDot, animatedStyle]} />;
}

// ─── Date separator ───────────────────────────────────────────────────────────

function DateSeparator({ label }: { label: string }) {
  return (
    <View style={styles.separatorRow}>
      <Text style={styles.separatorText}>{label}</Text>
    </View>
  );
}

// ─── Pagination constants ─────────────────────────────────────────────────────

const INITIAL_LIMIT = 30;
const LOAD_MORE_SIZE = 20;

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { sendText, sendOcr, sendAsr, isLoading: isSending } = useChat();
  const { pickImage } = useCamera();
  const [failedOcrIds, setFailedOcrIds] = useState<Set<string>>(new Set());

  function onOcrFail(imageMessageId: string) {
    setFailedOcrIds((prev) => new Set(prev).add(imageMessageId));
  }

  const [loadedLimit, setLoadedLimit] = useState(INITIAL_LIMIT);
  const { data: messages = [], isFetching: isFetchingMessages } =
    useLocalChatMessages(loadedLimit);
  const deleteMutation = useDeleteChatMessage();
  const clearMutation = useClearChatMessages();
  const { data: categories = [] } = useLocalCategories();

  // 用 ref 保存最新 messages，让 useCallback 不依赖 messages 数组引用
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // 数据变更后由 invalidateQueries 自动刷新，无需 focus refetch
  // （focus refetch 会导致从 image-viewer 返回时滚动位置重置）

  // 录音状态（从 ChatInputBar 提升上来）
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [metering, setMetering] = useState(0);

  // 语音播放
  const { playingId, play: playAudio } = useAudioPlayer();

  // Track keyboard height and visibility
  const keyboardHeight = useSharedValue(0);
  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (e) => {
      keyboardHeight.value = withTiming(e.endCoordinates.height, {
        duration: 250,
      });
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardHeight.value = withTiming(0, { duration: 250 });
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardHeight]);

  const bottomPanelAnimatedStyle = useAnimatedStyle(() => ({
    paddingBottom:
      keyboardHeight.value > 0 ? keyboardHeight.value + 16 : insets.bottom,
  }));

  // 是否还有更多历史消息可加载
  const hasMore = messages.length >= loadedLimit;

  function loadMore() {
    if (isFetchingMessages || !hasMore) return;
    setLoadedLimit((prev) => prev + LOAD_MORE_SIZE);
  }

  const handleDelete = useCallback(
    (messageId: string) => deleteMutation.mutate(messageId),
    [deleteMutation],
  );

  const handleEditRecord = useCallback(
    (messageId: string) => {
      const msg = messagesRef.current.find((m) => m.id === messageId);
      if (!msg || msg.content_type !== "bill_card") return;
      try {
        const tx = JSON.parse(msg.content) as Transaction;
        router.push({
          pathname: "/manual-entry",
          params: { txData: JSON.stringify(tx), msgId: msg.id },
        });
      } catch {
        /* ignore parse errors */
      }
    },
    [],
  );

  const handleResendOcr = useCallback(
    async (messageId: string) => {
      const msg = messagesRef.current.find((m) => m.id === messageId);
      if (!msg || !msg.content.startsWith("file://")) return;
      setFailedOcrIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
      try {
        const base64 = await FileSystem.readAsStringAsync(msg.content, {
          encoding: FileSystem.EncodingType.Base64,
        });
        sendOcr(base64, onOcrFail);
      } catch {
        setFailedOcrIds((prev) => new Set(prev).add(messageId));
      }
    },
    [sendOcr],
  );

  const handlePlayAudio = useCallback(
    (messageId: string) => {
      const msg = messagesRef.current.find((m) => m.id === messageId);
      if (!msg || msg.content_type !== "audio" || !msg.audio_uri) return;
      playAudio(msg.id, msg.audio_uri);
    },
    [playAudio],
  );

  const listItems = useMemo(() => {
    const items = buildListItems(messages, isSending);
    if (messages.length === 0) {
      items.push({ type: "message", data: WELCOME_MESSAGE });
    }
    return items;
  }, [messages, isSending]);

  function handleSelectTool(tool: string) {
    if (tool === "手动记账") {
      router.push("/manual-entry");
      return;
    }
    sendText(tool);
  }

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.type === "separator") {
        return <DateSeparator label={item.label} />;
      }
      if (item.type === "typing") {
        return (
          <View style={styles.typingWrapper}>
            <TypingIndicator />
          </View>
        );
      }
      const msg = item.data;

      return (
        <View style={styles.bubbleWrapper}>
          <ChatBubble
            message={msg}
            categories={categories}
            onDelete={handleDelete}
            onEditRecord={
              msg.content_type === "bill_card" ? handleEditRecord : undefined
            }
            isPlaying={playingId === msg.id}
            onPlay={
              msg.content_type === "audio" && msg.audio_uri
                ? handlePlayAudio
                : undefined
            }
            onResendOcr={
              msg.content_type === "image" &&
              msg.content.startsWith("file://") &&
              failedOcrIds.has(msg.id)
                ? handleResendOcr
                : undefined
            }
          />
        </View>
      );
    },
    [categories, handleDelete, handleEditRecord, handleResendOcr, handlePlayAudio, playingId, failedOcrIds],
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.replace("/(tabs)/diary")}
          style={styles.iconBtn}
          activeOpacity={0.75}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>

        <View style={styles.titleArea}>
          <PulseDot />
          <Text style={styles.titleText}>棉花助手</Text>
        </View>

        <TouchableOpacity
          style={styles.iconBtn}
          activeOpacity={0.75}
          onPress={() => {
            Alert.alert(
              "清空聊天记录",
              "确定要删除所有聊天记录吗？此操作不可恢复。",
              [
                { text: "取消", style: "cancel" },
                {
                  text: "清空",
                  style: "destructive",
                  onPress: () => clearMutation.mutate(),
                },
              ],
            );
          }}
        >
          <Text style={styles.clearIcon}>🗑</Text>
        </TouchableOpacity>
      </View>

      {/* ── Chat area ── */}
      <FlatList
        data={listItems}
        inverted
        keyExtractor={itemKey}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          isFetchingMessages && loadedLimit > INITIAL_LIMIT ? (
            <View style={styles.loadingMoreContainer}>
              <ActivityIndicator size="small" color={colors.textLighter} />
            </View>
          ) : !hasMore && messages.length > 0 ? (
            <View style={styles.noMoreContainer}>
              <Text style={styles.noMoreText}>— 没有更多了 —</Text>
            </View>
          ) : null
        }
      />

      {/* ── Bottom panel ── */}
      <Animated.View style={[styles.bottomPanel, bottomPanelAnimatedStyle]}>
        <ChatToolBar onSelectTool={handleSelectTool} />
        <ChatInputBar
          onSendText={sendText}
          onCamera={async () => {
            const base64 = await pickImage();
            if (base64) sendOcr(base64, onOcrFail);
          }}
          onVoice={(base64, durationSeconds) =>
            sendAsr(base64, durationSeconds)
          }
          onQuickAction={(actionText) => sendText(actionText)}
          recordingState={recordingState}
          onRecordingStateChange={setRecordingState}
          onMeteringChange={setMetering}
        />
      </Animated.View>

      {/* ── Voice recording overlay ── */}
      <VoiceRecordingOverlay
        visible={recordingState !== "idle"}
        state={recordingState === "idle" ? "recording" : recordingState}
        metering={metering}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },

  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.cream,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.md,
  },
  backArrow: {
    fontSize: 18,
    color: colors.text,
    lineHeight: 22,
  },
  clearIcon: {
    fontSize: 15,
  },
  titleArea: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.sage,
  },
  titleText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },

  // Chat list
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  bubbleWrapper: {
    // no additional wrapper styles needed
  },
  typingWrapper: {
    paddingVertical: spacing.sm,
  },

  // Date separator
  separatorRow: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  separatorText: {
    fontSize: 11,
    color: colors.textLighter,
  },

  // Load more / no more indicator (appears at top in inverted list)
  loadingMoreContainer: {
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  noMoreContainer: {
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  noMoreText: {
    fontSize: 11,
    color: colors.textLighter,
  },

  // Bottom panel
  bottomPanel: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.creamDark,
  },
});
