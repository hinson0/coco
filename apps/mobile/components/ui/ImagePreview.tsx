import { useRef } from 'react';
import { Image, Pressable, StyleSheet, type StyleProp, type ViewStyle, type View } from 'react-native';
import { useImageViewer } from './ImageViewerOverlay';

interface ImagePreviewProps {
  readonly uri: string;
  readonly style?: StyleProp<ViewStyle>;
}

export function ImagePreview({ uri, style }: ImagePreviewProps) {
  const thumbRef = useRef<View>(null);
  const { open, activeUri } = useImageViewer();
  // 当此图片正在全屏预览时，隐藏缩略图（让动画图片成为唯一可见实体）
  const isHidden = activeUri === uri;

  function handlePress() {
    thumbRef.current?.measureInWindow((x, y, w, h) => {
      open(uri, { x, y, w, h });
    });
  }

  return (
    <Pressable ref={thumbRef} onPress={handlePress} style={style}>
      <Image
        source={{ uri }}
        style={[styles.thumbnail, isHidden && styles.hidden]}
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
  hidden: {
    opacity: 0,
  },
});
