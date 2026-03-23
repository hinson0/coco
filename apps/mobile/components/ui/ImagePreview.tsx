import { useState, useRef, useCallback } from 'react';
import { Image, Modal, Pressable, View, StyleSheet, useWindowDimensions, type StyleProp, type ViewStyle, type GestureResponderEvent } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

interface ImagePreviewProps {
  readonly uri: string;
  readonly style?: StyleProp<ViewStyle>;
}

// ─── 计算两点距离 ───
function getDistance(touches: GestureResponderEvent['nativeEvent']['touches']) {
  if (touches.length < 2) return 0;
  const [a, b] = touches;
  const dx = a.pageX - b.pageX;
  const dy = a.pageY - b.pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function ImagePreview({ uri, style }: ImagePreviewProps) {
  const [visible, setVisible] = useState(false);
  const { width: screenW, height: screenH } = useWindowDimensions();

  // 双指缩放状态
  const scale = useSharedValue(1);
  const baseScaleRef = useRef(1);
  const initialDistRef = useRef(0);
  const isPinchingRef = useRef(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handleClose() {
    scale.value = withTiming(1, { duration: 150 });
    baseScaleRef.current = 1;
    setVisible(false);
  }

  const handleTouchStart = useCallback((e: GestureResponderEvent) => {
    if (e.nativeEvent.touches.length === 2) {
      isPinchingRef.current = true;
      initialDistRef.current = getDistance(e.nativeEvent.touches);
      baseScaleRef.current = scale.value;
    }
  }, [scale]);

  const handleTouchMove = useCallback((e: GestureResponderEvent) => {
    if (!isPinchingRef.current || e.nativeEvent.touches.length < 2) return;
    const dist = getDistance(e.nativeEvent.touches);
    if (initialDistRef.current === 0) return;
    const newScale = baseScaleRef.current * (dist / initialDistRef.current);
    scale.value = Math.min(Math.max(newScale, 1), 5);
  }, [scale]);

  const handleTouchEnd = useCallback((e: GestureResponderEvent) => {
    if (e.nativeEvent.touches.length < 2) {
      isPinchingRef.current = false;
      baseScaleRef.current = scale.value;
      // 如果缩放接近 1，弹回
      if (scale.value < 1.1) {
        scale.value = withTiming(1, { duration: 150 });
        baseScaleRef.current = 1;
      }
    }
  }, [scale]);

  // 单击关闭（只在非缩放状态下）
  const handlePress = useCallback(() => {
    if (scale.value < 1.1) {
      handleClose();
    }
  }, [scale]);

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
        <View
          style={styles.overlay}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <Pressable style={styles.imageWrapper} onPress={handlePress}>
            <Animated.Image
              source={{ uri }}
              style={[{ width: screenW, height: screenH * 0.8 }, animatedStyle]}
              resizeMode="contain"
            />
          </Pressable>
        </View>
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
  imageWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
