import { useEffect, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Text,
  Keyboard,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChatStore } from '../store/chatStore';
import { useChat } from '../hooks/useChat';
import { useChatMessages } from '../hooks/useChatMessages';
import { useDeleteChatMessage, useClearChatMessages } from '../hooks/useDeleteChatMessage';
import { useCategories } from '../hooks/useCategories';
import { ChatBubble } from '../components/chat/ChatBubble';
import { ChatToolBar } from '../components/chat/ChatToolBar';
import { ChatInputBar } from '../components/chat/ChatInputBar';
import { TypingIndicator } from '../components/chat/TypingIndicator';
import { ManualEntryForm } from '../components/ManualEntryForm';
import { colors, spacing, radii, shadows } from '../constants/theme';
import type { ChatMessage, PendingMessage } from '@coco/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

type ListItem =
  | { type: 'message'; data: ChatMessage }
  | { type: 'separator'; id: string; label: string }
  | { type: 'typing'; id: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateLabel(isoString: string): string {
  const d = new Date(isoString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86_400_000);
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (target.getTime() === today.getTime()) return '今天';
  if (target.getTime() === yesterday.getTime()) return '昨天';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function buildListItems(
  messages: readonly ChatMessage[],
  isLoading: boolean,
): ListItem[] {
  const items: ListItem[] = [];
  let lastDateLabel = '';

  for (const msg of messages) {
    const label = toDateLabel(msg.created_at);
    if (label !== lastDateLabel) {
      items.push({ type: 'separator', id: `sep-${msg.id}`, label });
      lastDateLabel = label;
    }
    items.push({ type: 'message', data: msg });
  }

  if (isLoading) {
    items.push({ type: 'typing', id: 'typing-indicator' });
  }

  return items.reverse();
}

function itemKey(item: ListItem): string {
  if (item.type === 'message') return item.data.id;
  if (item.type === 'separator') return item.id;
  return item.id;
}

// ─── Welcome message ──────────────────────────────────────────────────────────

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  user_id: '',
  role: 'assistant',
  content_type: 'text',
  content: '早上好呀~ 支持文字、语音、拍小票三种方式记账，随时告诉我就好 😊',
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

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { sendText, sendOcr, sendAsr } = useChat();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useChatMessages();
  const { pendingMessages, isLoading: isSending } = useChatStore();
  const deleteMutation = useDeleteChatMessage();
  const clearMutation = useClearChatMessages();
  const { data: catData } = useCategories();
  const categories = catData?.data ?? [];
  const [manualEntryVisible, setManualEntryVisible] = useState(false);

  // Track keyboard height and visibility
  const keyboardHeight = useSharedValue(0);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      keyboardHeight.value = withTiming(e.endCoordinates.height, { duration: 250 });
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardHeight.value = withTiming(0, { duration: 250 });
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, [keyboardHeight]);

  const bottomPanelAnimatedStyle = useAnimatedStyle(() => ({
    paddingBottom: keyboardHeight.value > 0 ? keyboardHeight.value + 16 : insets.bottom,
  }));

  // Merge server messages with pending messages
  const serverMessages: ChatMessage[] =
    data?.pages.flatMap((p) => p.data).reverse() ?? [];
  const total = data?.pages[0]?.total ?? 0;

  const allMessages: readonly ChatMessage[] = [
    ...serverMessages,
    ...pendingMessages,
  ];

  const listItems = buildListItems(allMessages, isSending);

  // Show welcome message only when no messages and no pending
  if (total === 0 && pendingMessages.length === 0) {
    listItems.push({ type: 'message', data: WELCOME_MESSAGE });
  }

  function handleSelectTool(tool: string) {
    if (tool === '手动记账') {
      setManualEntryVisible(true);
      return;
    }
    sendText(tool);
  }

  function renderItem({ item }: { item: ListItem }) {
    if (item.type === 'separator') {
      return <DateSeparator label={item.label} />;
    }
    if (item.type === 'typing') {
      return (
        <View style={styles.typingWrapper}>
          <TypingIndicator />
        </View>
      );
    }
    const msg = item.data;
    const pendingStatus = 'status' in msg ? (msg as PendingMessage).status : undefined;

    return (
      <View style={styles.bubbleWrapper}>
        <ChatBubble
          message={msg}
          status={pendingStatus}
          categories={categories}
          onDelete={() => deleteMutation.mutate(msg.id)}
          onRetry={pendingStatus === 'failed' ? () => {
            const pm = msg as PendingMessage;
            useChatStore.getState().removePending(pm.clientId);
            if (pm.content_type === 'text') sendText(pm.content);
            else if (pm.content_type === 'image') sendOcr(pm.content);
            else if (pm.content_type === 'audio') sendAsr(pm.content);
          } : undefined}
        />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.canGoBack() ? router.back() : router.push('/(tabs)/diary')}
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
            Alert.alert("清空聊天记录", "确定要删除所有聊天记录吗？此操作不可恢复。", [
              { text: "取消", style: "cancel" },
              { text: "清空", style: "destructive", onPress: () => clearMutation.mutate() },
            ]);
          }}
        >
          <Text style={styles.moreIcon}>···</Text>
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
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={colors.sage} />
            </View>
          ) : null
        }
      />

      {/* ── Bottom panel ── */}
      <Animated.View style={[styles.bottomPanel, bottomPanelAnimatedStyle]}>
        <ChatToolBar onSelectTool={handleSelectTool} />
        <ChatInputBar
          onSendText={sendText}
          onCamera={() => {/* OCR handled via camera picker */}}
          onVoice={() => {/* ASR handled via voice recorder */}}
          onPlus={() => {/* expand tool panel */}}
        />
      </Animated.View>

      <ManualEntryForm
        visible={manualEntryVisible}
        onClose={() => setManualEntryVisible(false)}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.cream,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  backArrow: {
    fontSize: 18,
    color: colors.text,
    lineHeight: 22,
  },
  moreIcon: {
    fontSize: 14,
    color: colors.text,
    letterSpacing: 1,
    lineHeight: 18,
  },
  titleArea: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: '700',
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
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  separatorText: {
    fontSize: 11,
    color: colors.textLighter,
  },

  // Bottom panel
  bottomPanel: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.creamDark,
  },

  // Loading more indicator
  loadingMore: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});
