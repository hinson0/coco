import { Pressable, StyleSheet } from 'react-native';
import { AppText } from '../ui/AppText';
import { colors } from '../../constants/theme';

interface SuggestionChipProps {
  readonly label: string;
  readonly onPress: () => void;
}

export function SuggestionChip({ label, onPress }: SuggestionChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
    >
      {({ pressed }) => (
        <AppText size="md" weight="medium" color={pressed ? colors.white : colors.sage}>
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.sagePale,
    borderRadius: 20,
  },
  chipPressed: {
    backgroundColor: colors.sage,
  },
});
