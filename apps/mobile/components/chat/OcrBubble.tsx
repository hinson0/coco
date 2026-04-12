import { View, StyleSheet } from "react-native";
import { AppText } from "../ui/AppText";
import { ImagePreview } from "../ui/ImagePreview";
import { colors, radii, spacing } from "../../constants/theme";

interface OcrBubbleProps {
  readonly imageUri?: string;
}

function hasValidImage(uri?: string): uri is string {
  return uri != null && (uri.startsWith("file://") || uri.startsWith("http"));
}

export function OcrBubble({ imageUri }: OcrBubbleProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.bubble}>
        {/* Receipt preview area */}
        <View style={styles.imageArea}>
          {hasValidImage(imageUri) ? (
            <ImagePreview uri={imageUri} style={styles.imageContainer} />
          ) : (
            <View style={styles.placeholder}>
              <AppText size="3xl">📷</AppText>
              <AppText size="base" color={colors.textLighter}>
                图片未保存
              </AppText>
            </View>
          )}
        </View>

        {/* Bottom strip */}
        <View style={styles.strip}>
          <AppText size="base" weight="medium" color={colors.white}>
            📸 小票识别
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: "flex-end",
  },
  bubble: {
    width: 160,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderTopRightRadius: 6,
    overflow: "hidden",
  },
  imageArea: {
    width: "100%",
    height: 120,
  },
  imageContainer: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  strip: {
    backgroundColor: colors.sage,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
});
