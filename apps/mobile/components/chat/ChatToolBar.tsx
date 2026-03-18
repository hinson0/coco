import { ScrollView, Pressable, StyleSheet } from 'react-native';
import { AppText } from '../ui/AppText';
import { colors, spacing } from '../../constants/theme';

interface ToolItem {
  readonly icon: string;
  readonly label: string;
}

const TOOLS: ToolItem[] = [
  { icon: '✏️', label: '手动记账' },
  { icon: '📊', label: '月度报告' },
  { icon: '🔄', label: '重复记' },
];

interface ChatToolBarProps {
  readonly onSelectTool: (tool: string) => void;
}

export function ChatToolBar({ onSelectTool }: ChatToolBarProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {TOOLS.map((tool) => (
        <Pressable
          key={tool.label}
          onPress={() => onSelectTool(tool.label)}
          style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
        >
          <AppText size="md">{tool.icon}</AppText>
          <AppText size="md" color={colors.text} style={styles.label}>{tool.label}</AppText>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.creamDark,
    borderRadius: 20,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  itemPressed: {
    opacity: 0.75,
  },
  label: {
    // inherits from AppText
  },
});
