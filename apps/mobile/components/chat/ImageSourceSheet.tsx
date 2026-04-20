import {
  Pressable,
  type PressableStateCallbackType,
  StyleSheet,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { AppText } from "../ui/AppText";
import { colors, shadows, spacing } from "../../constants/theme";

interface ImageSourceSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onPickCamera: () => void;
  readonly onPickLibrary: () => void;
}

export function ImageSourceSheet({
  visible,
  onClose,
  onPickCamera,
  onPickLibrary,
}: ImageSourceSheetProps) {
  if (!visible) return null;

  function handle(source: "camera" | "library") {
    Haptics.selectionAsync();
    onClose();
    if (source === "camera") onPickCamera();
    else onPickLibrary();
  }

  const optionStyle = ({ pressed }: PressableStateCallbackType) => [
    styles.option,
    pressed && styles.pressed,
  ];

  return (
    <View style={styles.sheet}>
      <Pressable onPress={() => handle("camera")} style={optionStyle}>
        <AppText size="7xl" style={styles.emoji}>
          📷
        </AppText>
        <AppText size="lg" weight="medium">
          拍照
        </AppText>
      </Pressable>
      <Pressable onPress={() => handle("library")} style={optionStyle}>
        <AppText size="7xl" style={styles.emoji}>
          🖼️
        </AppText>
        <AppText size="lg" weight="medium">
          相册
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flexDirection: "row",
    gap: spacing.md,
    alignSelf: "center",
    width: "85%",
    maxWidth: 320,
    padding: spacing.md,
    marginVertical: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  option: {
    flex: 1,
    aspectRatio: 1.1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: 12,
    backgroundColor: colors.cream,
  },
  pressed: {
    opacity: 0.75,
  },
  emoji: {
    lineHeight: 36,
  },
});
