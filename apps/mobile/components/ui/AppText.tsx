import { Text, type TextProps, type TextStyle } from 'react-native';
import { colors, typography } from '../../constants/theme';

interface AppTextProps extends TextProps {
  readonly size?: keyof typeof typography.sizes;
  readonly weight?: keyof typeof typography.weights;
  readonly color?: string;
}

export function AppText({ size = 'xl', weight = 'regular', color = colors.text, style, children, ...rest }: AppTextProps) {
  const textStyle: TextStyle = {
    fontSize: typography.sizes[size],
    fontWeight: typography.weights[weight],
    color,
  };
  return <Text style={[textStyle, style]} {...rest}>{children}</Text>;
}
