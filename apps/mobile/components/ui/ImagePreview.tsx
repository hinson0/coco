import { useState, useRef } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';

interface ImagePreviewProps {
  readonly uri: string;
  readonly style?: StyleProp<ViewStyle>;
}

export function ImagePreview({ uri, style }: ImagePreviewProps) {
  const [visible, setVisible] = useState(false);
  const { width: screenW, height: screenH } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);

  function handleClose() {
    // 关闭时重置缩放
    scrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
    setVisible(false);
  }

  return (
    <>
      <Pressable onPress={() => setVisible(true)} style={style}>
        <Image source={{ uri }} style={styles.thumbnail} resizeMode="cover" />
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <Pressable style={styles.overlay} onPress={handleClose}>
          <ScrollView
            ref={scrollRef}
            maximumZoomScale={4}
            minimumZoomScale={1}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            centerContent
          >
            <Image
              source={{ uri }}
              style={{ width: screenW, height: screenH * 0.8 }}
              resizeMode="contain"
            />
          </ScrollView>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  scrollContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
