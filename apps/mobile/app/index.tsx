import { useEffect, useRef } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Text,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChatStore } from '../store/chatStore';
import { useChat } from '../hooks/useChat';
import { ChatBubble } from '../components/chat/ChatBubble';
import { ChatToolBar } from '../components/chat/ChatToolBar';
import { ChatInputBar } from '../components/chat/ChatInputBar';
import { TypingIndicator } from '../components/chat/TypingIndicator';
import { colors, spacing, radii, shadows } from '../constants/theme';
import type { ChatMessage } from '@coco/shared';

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
  // FlatList is inverted, so items are rendered bottom→top.
  // We build the list in chronological order then reverse it so the
  // inverted FlatList displays them newest at bottom.
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

  // Reverse for the inverted FlatList
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
  const { messages, isLoading, addMessage } = useChatStore();
  const { sendText, sendOcr: _sendOcr, sendAsr: _sendAsr } = useChat();
  const hasInitialized = useRef(false);

  // Add welcome message once on mount if messages are empty
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      if (messages.length === 0) {
        addMessage(WELCOME_MESSAGE);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const listItems = buildListItems(messages, isLoading);

  function handleSelectTool(tool: string) {
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
    return (
      <View style={styles.bubbleWrapper}>
        <ChatBubble message={item.data} />
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

        <TouchableOpacity style={styles.iconBtn} activeOpacity={0.75}>
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
      />

      {/* ── Bottom panel ── */}
      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom }]}>
        <ChatToolBar onSelectTool={handleSelectTool} />
        <ChatInputBar
          onSendText={sendText}
          onCamera={() => {/* OCR handled via camera picker */}}
          onVoice={() => {/* ASR handled via voice recorder */}}
          onPlus={() => {/* expand tool panel */}}
        />
      </View>
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
    // no additional wrapper styles needed; ChatBubble handles alignment
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
});
