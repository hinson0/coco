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
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChatBubble } from "../components/chat/ChatBubble";
import { PulseDot } from "../components/ui/PulseDot";
import type { RecordingState } from "../components/chat/ChatInputBar";
import { ChatInputBar } from "../components/chat/ChatInputBar";
import { ChatToolBar } from "../components/chat/ChatToolBar";
import { StreamingBubble } from "../components/chat/StreamingBubble";
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
import { CHAT_INITIAL_LIMIT } from "../lib/db/queries";
// buildListItems / ListItem / itemKey 抽到 chat-list-items.ts 以便单测
// （在 node 环境下不牵连 react-native 模块）。
import { buildListItems, itemKey, type ListItem } from "./chat-list-items";

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

// PulseDot 已提取到 components/ui/PulseDot.tsx

// ─── Date separator ───────────────────────────────────────────────────────────

function DateSeparator({ label }: { label: string }) {
  return (
    <View style={styles.separatorRow}>
      <Text style={styles.separatorText}>{label}</Text>
    </View>
  );
}

// ─── Pagination constants ─────────────────────────────────────────────────────

const LOAD_MORE_SIZE = 20;

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const mountTime = useRef(Date.now());
  const [loadMs, setLoadMs] = useState<number | null>(null);

  const insets = useSafeAreaInsets();
  const {
    sendText,
    sendOcr,
    sendAsr,
    isLoading: isSending,
    streamingText,
  } = useChat();
  const { pickImage, pickFromLibrary } = useCamera();
  const [failedOcrIds, setFailedOcrIds] = useState<Set<string>>(new Set());

  function onOcrFail(imageMessageId: string) {
    setFailedOcrIds((prev) => new Set(prev).add(imageMessageId));
  }

  const [loadedLimit, setLoadedLimit] = useState(CHAT_INITIAL_LIMIT);
  const { data: messages = [], isFetching: isFetchingMessages } =
    useLocalChatMessages(loadedLimit);
  const deleteMutation = useDeleteChatMessage();
  const clearMutation = useClearChatMessages();
  const { data: categories = [] } = useLocalCategories();

  // 用 ref 保存最新引用，让 useCallback 不依赖数组引用变化
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;

  // 跟踪哪些 bill_card 已经渲染过，只对新增的应用 FadeInDown 入场动画。
  // 首次从 SQLite 加载出的历史卡片全部视为"已见"，避免页面挂载时群抖。
  const seenBillCardIds = useRef<Set<string>>(new Set());
  const firstLoadMarked = useRef(false);
  useEffect(() => {
    if (firstLoadMarked.current || messages.length === 0) return;
    for (const m of messages) {
      if (m.content_type === "bill_card") {
        seenBillCardIds.current.add(m.id);
      }
    }
    firstLoadMarked.current = true;
  }, [messages]);

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

  // 测量加载耗时
  useEffect(() => {
    if (loadMs === null) {
      setLoadMs(Date.now() - mountTime.current);
    }
  }, [messages, loadMs]);

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

  const handleEditRecord = useCallback((messageId: string) => {
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
  }, []);

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
    const items = buildListItems(messages, isSending, streamingText);
    if (messages.length === 0) {
      items.push({ type: "message", data: WELCOME_MESSAGE });
    }
    return items;
  }, [messages, isSending, streamingText]);

  function handleSelectTool(tool: string) {
    if (tool === "手动记账") {
      router.push("/manual-entry");
      return;
    }
    if (tool === "使用帮助") {
      router.push("/ai-help");
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
      if (item.type === "streaming") {
        return (
          <View style={styles.typingWrapper}>
            <StreamingBubble text={item.text} />
          </View>
        );
      }
      const msg = item.data;

      // 仅对"本次会话内新增的" bill_card 应用淡入下滑入场动画，
      // 避免历史消息首次加载时群抖。
      const isNewBillCard =
        msg.content_type === "bill_card" &&
        firstLoadMarked.current &&
        !seenBillCardIds.current.has(msg.id);
      if (msg.content_type === "bill_card") {
        seenBillCardIds.current.add(msg.id);
      }

      const bubbleNode = (
        <View style={styles.bubbleWrapper}>
          <ChatBubble
            message={msg}
            categories={categoriesRef.current}
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

      return isNewBillCard ? (
        <Animated.View entering={FadeInDown.duration(250)}>
          {bubbleNode}
        </Animated.View>
      ) : (
        bubbleNode
      );
    },
    [
      handleDelete,
      handleEditRecord,
      handleResendOcr,
      handlePlayAudio,
      playingId,
      failedOcrIds,
    ],
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
          <Text style={styles.titleText}>
            CoCo AI记账助手{loadMs !== null && __DEV__ ? ` (${loadMs}ms)` : ""}
          </Text>
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
        initialNumToRender={10}
        maxToRenderPerBatch={5}
        windowSize={7}
        removeClippedSubviews={Platform.OS === "android"}
        ListFooterComponent={
          isFetchingMessages && loadedLimit > CHAT_INITIAL_LIMIT ? (
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
          onPickCamera={async () => {
            const base64 = await pickImage();
            if (base64) sendOcr(base64, onOcrFail);
          }}
          onPickLibrary={async () => {
            const base64 = await pickFromLibrary();
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
    fontSize: 19,
    color: colors.text,
    lineHeight: 23,
  },
  clearIcon: {
    fontSize: 16,
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
    fontSize: 17,
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
    fontSize: 12,
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
    fontSize: 12,
    color: colors.textLighter,
  },

  // Bottom panel
  bottomPanel: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.creamDark,
  },
});
