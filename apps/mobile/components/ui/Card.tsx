import { View, type ViewProps, type ViewStyle } from 'react-native';
import { colors, radii, shadows } from '../../constants/theme';

interface CardProps extends ViewProps {
  readonly radius?: keyof typeof radii;
  readonly shadow?: keyof typeof shadows;
  readonly padding?: number;
}

export function Card({ radius = 'lg', shadow = 'md', padding = 18, style, children, ...rest }: CardProps) {
  const cardStyle: ViewStyle = {
    backgroundColor: colors.white,
    borderRadius: radii[radius],
    padding,
    ...shadows[shadow],
  };
  return <View style={[cardStyle, style]} {...rest}>{children}</View>;
}
