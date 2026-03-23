import { Image, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import Animated from 'react-native-reanimated';

interface ImagePreviewProps {
  readonly uri: string;
  readonly style?: StyleProp<ViewStyle>;
}

export function ImagePreview({ uri, style }: ImagePreviewProps) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/image-viewer', params: { uri } })}
      style={style}
    >
      {/* sharedTransitionTag 让 reanimated 自动处理两个屏幕间的转场动画 */}
      <Animated.Image
        sharedTransitionTag={`image-${uri}`}
        source={{ uri }}
        style={styles.thumbnail}
        resizeMode="cover"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  thumbnail: {
    width: '100%',
    height: '100%',
  },
});
