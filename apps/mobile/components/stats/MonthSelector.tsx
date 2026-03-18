import { View, Pressable, StyleSheet } from 'react-native';
import { AppText } from '../ui/AppText';
import { colors, shadows } from '../../constants/theme';

interface MonthSelectorProps {
  readonly label: string;
  readonly onPrev: () => void;
  readonly onNext: () => void;
}

function ArrowButton({ onPress, children }: { onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} style={styles.arrow}>
      <AppText size="2xl" weight="bold" color={colors.text}>{children}</AppText>
    </Pressable>
  );
}

export function MonthSelector({ label, onPrev, onNext }: MonthSelectorProps) {
  return (
    <View style={styles.container}>
      <ArrowButton onPress={onPrev}>‹</ArrowButton>
      <AppText size="xl" weight="bold" color={colors.text}>{label}</AppText>
      <ArrowButton onPress={onNext}>›</ArrowButton>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  arrow: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
});
