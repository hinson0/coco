import { View, StyleSheet } from 'react-native';
import { AppText } from '../ui/AppText';
import { colors, radii, spacing, shadows } from '../../constants/theme';
import type { ChatMessage, Transaction } from '@coco/shared';
import { VoiceBubble } from './VoiceBubble';
import { OcrBubble } from './OcrBubble';
import { RecordCard } from './RecordCard';

interface ChatBubbleProps {
  readonly message: ChatMessage;
  readonly transaction?: Transaction;
  readonly onConfirmRecord?: () => void;
  readonly onEditRecord?: () => void;
  readonly onSuggestion?: (label: string) => void;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function AiAvatar() {
  return (
    <View style={styles.avatarRow}>
      <View style={styles.avatar}>
        <AppText size="base">🤖</AppText>
      </View>
      <AppText size="base" color={colors.textLighter}>棉花助手</AppText>
    </View>
  );
}

export function ChatBubble({ message, transaction, onConfirmRecord, onEditRecord }: ChatBubbleProps) {
  const { role, content_type, content, created_at } = message;
  const time = formatTime(created_at);
  const isUser = role === 'user';

  // User audio
  if (isUser && content_type === 'audio') {
    return (
      <View style={styles.userWrapper}>
        <VoiceBubble
          role="user"
          duration={parseInt(content, 10) || 0}
          isPlaying={false}
          onPlay={() => {}}
        />
        <AppText size="sm" color={colors.textLighter} style={styles.timeRight}>{time}</AppText>
      </View>
    );
  }

  // User image (OCR)
  if (isUser && content_type === 'image') {
    return (
      <View style={styles.userWrapper}>
        <OcrBubble imageUri={content || undefined} />
        <AppText size="sm" color={colors.textLighter} style={styles.timeRight}>{time}</AppText>
      </View>
    );
  }

  // User text
  if (isUser && content_type === 'text') {
    return (
      <View style={styles.userWrapper}>
        <View style={[styles.bubble, styles.bubbleUser]}>
          <AppText size="xl" color={colors.white}>{content}</AppText>
        </View>
        <AppText size="sm" color={colors.textLighter} style={styles.timeRight}>{time}</AppText>
      </View>
    );
  }

  // Assistant bill_card
  if (!isUser && content_type === 'bill_card') {
    let parsedTransaction: Transaction | undefined = transaction;
    if (!parsedTransaction) {
      try {
        parsedTransaction = JSON.parse(content) as Transaction;
      } catch {
        parsedTransaction = undefined;
      }
    }
    const variant = parsedTransaction?.source === 'ocr' ? 'ocr' : 'text';

    return (
      <View style={styles.assistantWrapper}>
        <AiAvatar />
        <View style={[styles.bubble, styles.bubbleAssistant]}>
          {parsedTransaction ? (
            <RecordCard
              transaction={parsedTransaction}
              status="pending"
              onConfirm={onConfirmRecord}
              onEdit={onEditRecord}
              variant={variant}
            />
          ) : (
            <AppText size="xl" color={colors.text}>{content}</AppText>
          )}
        </View>
        <AppText size="sm" color={colors.textLighter} style={styles.timeLeft}>{time}</AppText>
      </View>
    );
  }

  // Assistant text / nl_result
  if (!isUser && (content_type === 'text' || content_type === 'nl_result')) {
    return (
      <View style={styles.assistantWrapper}>
        <AiAvatar />
        <View style={[styles.bubble, styles.bubbleAssistant]}>
          <AppText size="xl" color={colors.text}>{content}</AppText>
        </View>
        <AppText size="sm" color={colors.textLighter} style={styles.timeLeft}>{time}</AppText>
      </View>
    );
  }

  // Fallback
  return (
    <View style={isUser ? styles.userWrapper : styles.assistantWrapper}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <AppText size="xl" color={isUser ? colors.white : colors.text}>{content}</AppText>
      </View>
      <AppText size="sm" color={colors.textLighter} style={isUser ? styles.timeRight : styles.timeLeft}>
        {time}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  userWrapper: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
    maxWidth: '80%',
  },
  assistantWrapper: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
    maxWidth: '80%',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  timeLeft: {
    marginTop: spacing.xs,
    paddingLeft: spacing.xs,
  },
  timeRight: {
    marginTop: spacing.xs,
    paddingRight: spacing.xs,
  },
});
