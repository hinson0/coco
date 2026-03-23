import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';

interface ImagePreviewProps {
  readonly uri: string;
  readonly style?: StyleProp<ViewStyle>;
}

export function ImagePreview({ uri, style }: ImagePreviewProps) {
  const [visible, setVisible] = useState(false);
  const { width: screenW, height: screenH } = useWindowDimensions();

  return (
    <>
      <Pressable onPress={() => setVisible(true)} style={style}>
        <Image source={{ uri }} style={styles.thumbnail} resizeMode="cover" />
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <Image
            source={{ uri }}
            style={{ width: screenW * 0.9, height: screenH * 0.7 }}
            resizeMode="contain"
          />
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
    alignItems: 'center',
    justifyContent: 'center',
  },
});
