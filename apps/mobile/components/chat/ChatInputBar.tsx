import { useState } from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { AppText } from '../ui/AppText';
import { colors, radii, spacing, shadows } from '../../constants/theme';

interface ChatInputBarProps {
  readonly onSendText: (text: string) => void;
  readonly onCamera: () => void;
  readonly onVoice: () => void;
  readonly onPlus: () => void;
}

export function ChatInputBar({ onSendText, onCamera, onVoice, onPlus }: ChatInputBarProps) {
  const [text, setText] = useState('');

  function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSendText(trimmed);
    setText('');
  }

  return (
    <View style={styles.container}>
      {/* Camera button */}
      <Pressable onPress={onCamera} style={({ pressed }) => [styles.iconBtn, pressed && styles.btnPressed]}>
        <AppText size="2xl">📷</AppText>
      </Pressable>

      {/* Text input */}
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="记一笔或按住说话..."
        placeholderTextColor={colors.textLighter}
        returnKeyType="default"
        style={[styles.input, { maxHeight: 100 }]}
        multiline
      />

      {text.trim() ? (
        <Pressable onPress={handleSubmit} style={({ pressed }) => [styles.sendBtn, pressed && styles.btnPressed]}>
          <AppText size="sm" weight="semibold" color={colors.white}>发送</AppText>
        </Pressable>
      ) : (
        <Pressable onPress={onVoice} style={({ pressed }) => [styles.iconBtn, styles.voiceBtn, pressed && styles.btnPressed]}>
          <AppText size="2xl">🎤</AppText>
        </Pressable>
      )}

      {/* Plus button */}
      <Pressable onPress={onPlus} style={({ pressed }) => [styles.iconBtn, styles.plusBtn, pressed && styles.btnPressed]}>
        <AppText size="4xl" weight="regular" color={colors.white}>+</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.cream,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtn: {
    height: 38,
    paddingHorizontal: spacing.lg,
    borderRadius: 19,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceBtn: {
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.creamDeeper,
  },
  plusBtn: {
    backgroundColor: colors.sage,
    ...shadows.sm,
  },
  btnPressed: {
    opacity: 0.75,
  },
  input: {
    flex: 1,
    height: 44,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.creamDeeper,
    borderRadius: radii.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    fontSize: 14,
    color: colors.text,
  },
});
