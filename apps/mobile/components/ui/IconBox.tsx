import { View, type ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { categoryColors, radii } from '../../constants/theme';

interface IconBoxProps {
  readonly emoji: string;
  readonly colorName: keyof typeof categoryColors;
}

export function IconBox({ emoji, colorName }: IconBoxProps) {
  const style: ViewStyle = {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: categoryColors[colorName].bg,
    alignItems: 'center',
    justifyContent: 'center',
  };
  return (
    <View style={style}>
      <AppText size="3xl">{emoji}</AppText>
    </View>
  );
}
