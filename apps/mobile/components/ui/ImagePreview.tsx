import { useRef } from 'react';
import { Image, Pressable, StyleSheet, type StyleProp, type ViewStyle, type View } from 'react-native';
import { useImageViewer } from './ImageViewerOverlay';

interface ImagePreviewProps {
  readonly uri: string;
  readonly style?: StyleProp<ViewStyle>;
}

export function ImagePreview({ uri, style }: ImagePreviewProps) {
  const thumbRef = useRef<View>(null);
  const { open } = useImageViewer();

  function handlePress() {
    thumbRef.current?.measureInWindow((x, y, w, h) => {
      open(uri, { x, y, w, h });
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
