import { Image } from "expo-image";
import {
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { router } from "expo-router";

interface ImagePreviewProps {
  readonly uri: string;
  readonly style?: StyleProp<ViewStyle>;
}

export function ImagePreview({ uri, style }: ImagePreviewProps) {
  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: "/image-viewer", params: { uri } })
      }
      style={style}
    >
      <Image source={uri} style={styles.thumbnail} contentFit="cover" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  thumbnail: {
    width: "100%",
    height: "100%",
  },
});
