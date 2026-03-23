import { useRef } from 'react';
import { Image, Pressable, StyleSheet, type StyleProp, type ViewStyle, type View } from 'react-native';
import { router } from 'expo-router';

interface ImagePreviewProps {
  readonly uri: string;
  readonly style?: StyleProp<ViewStyle>;
}

export function ImagePreview({ uri, style }: ImagePreviewProps) {
  const thumbRef = useRef<View>(null);

  function handlePress() {
    // 获取缩略图在屏幕上的绝对位置，传给 viewer 做动画
    thumbRef.current?.measureInWindow((x, y, width, height) => {
      router.push({
        pathname: '/image-viewer',
        params: {
          uri,
          thumbX: Math.round(x),
          thumbY: Math.round(y),
          thumbW: Math.round(width),
          thumbH: Math.round(height),
        },
      });
    });
  }

  return (
    <Pressable ref={thumbRef} onPress={handlePress} style={style}>
      <Image source={{ uri }} style={styles.thumbnail} resizeMode="cover" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  thumbnail: {
    width: '100%',
    height: '100%',
  },
});
