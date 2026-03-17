import { View, Image, StyleSheet } from 'react-native';
import { AppText } from '../ui/AppText';
import { colors, radii, spacing } from '../../constants/theme';

interface OcrBubbleProps {
  readonly imageUri?: string;
}

export function OcrBubble({ imageUri }: OcrBubbleProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.bubble}>
        {/* Receipt preview area */}
        <View style={styles.imageArea}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.placeholder}>
              <AppText size="2xl">🧾</AppText>
              <View style={styles.lines}>
                <View style={[styles.line, styles.lineLong]} />
                <View style={[styles.line, styles.lineShort]} />
                <View style={[styles.line, styles.lineMedium]} />
              </View>
              <AppText size="2xl" weight="bold" color={colors.text} style={styles.amount}>
                ¥ 88.00
              </AppText>
            </View>
          )}
        </View>

        {/* Bottom strip */}
        <View style={styles.strip}>
          <AppText size="base" weight="medium" color={colors.white}>📸 小票识别</AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'flex-end',
  },
  bubble: {
    width: 160,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderTopRightRadius: 6,
    overflow: 'hidden',
  },
  imageArea: {
    width: '100%',
    height: 120,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  lines: {
    width: '70%',
    gap: spacing.xs,
  },
  line: {
    height: 4,
    backgroundColor: colors.creamDark,
    borderRadius: 2,
  },
  lineLong: {
    width: '100%',
  },
  lineShort: {
    width: '50%',
  },
  lineMedium: {
    width: '75%',
  },
  amount: {
    marginTop: spacing.xs,
  },
  strip: {
    backgroundColor: colors.sage,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
});
