import { View, StyleSheet, TouchableOpacity, Alert, type ViewStyle } from 'react-native';
import { AppText } from '../ui/AppText';
import { colors, radii, spacing, shadows } from '../../constants/theme';
import type { ChatMessage, Transaction, Category } from '@coco/shared';
import { VoiceBubble } from './VoiceBubble';
import { OcrBubble } from './OcrBubble';
import { RecordCard } from './RecordCard';

interface ChatBubbleProps {
  readonly message: ChatMessage;
  readonly status?: 'pending' | 'failed';
  readonly onDelete?: () => void;
  readonly onRetry?: () => void;
  readonly transaction?: Transaction;
  readonly categories?: readonly Category[];
  readonly onEditRecord?: () => void;
  readonly onSuggestion?: (label: string) => void;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function Avatar({ emoji, style }: { emoji: string; style: ViewStyle }) {
  return (
    <View style={style}>
      <AppText size="base">{emoji}</AppText>
    </View>
  );
}

function handleLongPress(onDelete?: () => void) {
  if (!onDelete) return;
  Alert.alert("消息操作", "", [
    { text: "删除", style: "destructive", onPress: onDelete },
    { text: "取消", style: "cancel" },
  ]);
}

function FailedIndicator({ onRetry }: { readonly onRetry?: () => void }) {
  return (
    <TouchableOpacity onPress={onRetry} style={styles.failedIcon}>
      <AppText size="base" color="#E74C3C">⚠</AppText>
    </TouchableOpacity>
  );
}

export function ChatBubble({ message, status, onDelete, onRetry, transaction, categories, onEditRecord }: ChatBubbleProps) {
  const { role, content_type, content, created_at } = message;
  const time = formatTime(created_at);
  const isUser = role === 'user';
  const isPending = status === 'pending';
  const isFailed = status === 'failed';

  // ── User messages: [failed?] [bubble] [avatar] ──
  if (isUser) {
    const bubbleContent = (() => {
      if (content_type === 'audio') {
        return (
          <VoiceBubble
            role="user"
            duration={parseInt(content, 10) || 0}
            isPlaying={false}
            onPlay={() => {}}
          />
        );
      }
      if (content_type === 'image') {
        return <OcrBubble imageUri={content || undefined} />;
      }
      return (
        <View style={[styles.bubble, styles.bubbleUser]}>
          <AppText size="xl" color={colors.white}>{content}</AppText>
        </View>
      );
    })();

    return (
      <View style={[styles.rowUser, isPending && styles.pendingOpacity]}>
        {isFailed && <FailedIndicator onRetry={onRetry} />}
        <TouchableOpacity
          style={styles.bubbleArea}
          activeOpacity={0.75}
          onLongPress={() => handleLongPress(onDelete)}
        >
          {bubbleContent}
          <AppText size="sm" color={colors.textLighter} style={styles.timeRight}>{time}</AppText>
        </TouchableOpacity>
        <Avatar emoji="😊" style={styles.avatarUser} />
      </View>
    );
  }

  // ── Assistant messages: [avatar] [bubble] ──

  // bill_card
  if (content_type === 'bill_card') {
    let parsedTransaction: Transaction | undefined = transaction;
    if (!parsedTransaction) {
      try {
        parsedTransaction = JSON.parse(content) as Transaction;
      } catch {
        parsedTransaction = undefined;
      }
    }
    const variant = parsedTransaction?.source === 'ocr' ? 'ocr' : 'text';
    const categoryName = parsedTransaction && categories
      ? categories.find((c) => c.id === parsedTransaction.category_id)?.name
      : undefined;

    return (
      <View style={[styles.rowAssistant, styles.rowCard]}>
        <Avatar emoji="🌿" style={styles.avatarAi} />
        <TouchableOpacity
          style={styles.bubbleArea}
          activeOpacity={0.75}
          onLongPress={() => handleLongPress(onDelete)}
        >
          <View style={[styles.bubble, styles.bubbleAssistant]}>
            {parsedTransaction ? (
              <RecordCard
                transaction={parsedTransaction}
                categoryName={categoryName}
                onEdit={onEditRecord}
                onDelete={onDelete}
                variant={variant}
              />
            ) : (
              <AppText size="xl" color={colors.text}>{content}</AppText>
            )}
          </View>
          <AppText size="sm" color={colors.textLighter} style={styles.timeLeft}>{time}</AppText>
        </TouchableOpacity>
      </View>
    );
  }

  // text / nl_result / fallback
  return (
    <View style={styles.rowAssistant}>
      <Avatar emoji="🌿" style={styles.avatarAi} />
      <TouchableOpacity
        style={styles.bubbleArea}
        activeOpacity={0.75}
        onLongPress={() => handleLongPress(onDelete)}
      >
        <View style={[styles.bubble, styles.bubbleAssistant]}>
          <AppText size="xl" color={colors.text}>{content}</AppText>
        </View>
        <AppText size="sm" color={colors.textLighter} style={styles.timeLeft}>{time}</AppText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  // Row layouts — horizontal, avatar beside bubble
  rowUser: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'flex-end',
    maxWidth: '85%',
  },
  rowAssistant: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
    maxWidth: '85%',
  },
  rowCard: {
    maxWidth: '95%',
  },

  // Avatars
  avatarAi: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.sagePale,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    marginTop: 2,
  },
  avatarUser: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.creamDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
    marginTop: 2,
  },

  // Bubble area (content + time, shrinks to fit)
  bubbleArea: {
    flexShrink: 1,
  },

  // Bubbles
  bubble: {
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  bubbleUser: {
    backgroundColor: colors.sage,
    borderTopRightRadius: 6,
  },
  bubbleAssistant: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 6,
    ...shadows.md,
  },

  // Time
  timeLeft: {
    marginTop: spacing.xs,
    paddingLeft: spacing.xs,
  },
  timeRight: {
    marginTop: spacing.xs,
    alignSelf: 'flex-end',
    paddingRight: spacing.xs,
  },

  // Failed / pending
  failedIcon: {
    marginRight: spacing.xs,
    justifyContent: 'center',
  },
  pendingOpacity: {
    opacity: 0.6,
  },
});
