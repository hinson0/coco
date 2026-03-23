import { useState, useRef, useCallback } from 'react';
import { Image, Modal, View, StyleSheet, useWindowDimensions, type StyleProp, type ViewStyle, type GestureResponderEvent } from 'react-native';
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

const TAP_THRESHOLD = 8;

export function ImagePreview({ uri, style }: ImagePreviewProps) {
  const [visible, setVisible] = useState(false);
  const { width: screenW, height: screenH } = useWindowDimensions();

  // 缩放
  const scale = useSharedValue(1);
  const baseScaleRef = useRef(1);
  const initialDistRef = useRef(0);
  const isPinchingRef = useRef(false);

  // 平移（放大后单指拖动）
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const baseTxRef = useRef(0);
  const baseTyRef = useRef(0);
  const startPageXRef = useRef(0);
  const startPageYRef = useRef(0);
  const isDraggingRef = useRef(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  function resetAll(animated = true) {
    if (animated) {
      scale.value = withTiming(1, { duration: 150 });
      translateX.value = withTiming(0, { duration: 150 });
      translateY.value = withTiming(0, { duration: 150 });
    } else {
      scale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
    }
    baseScaleRef.current = 1;
    baseTxRef.current = 0;
    baseTyRef.current = 0;
  }

  function handleClose() {
    resetAll(false);
    setVisible(false);
  }

  const handleTouchStart = useCallback((e: GestureResponderEvent) => {
    const { touches } = e.nativeEvent;

    if (touches.length === 2) {
      isPinchingRef.current = true;
      isDraggingRef.current = false;
      initialDistRef.current = getDistance(touches);
      baseScaleRef.current = scale.value;
      baseTxRef.current = translateX.value;
      baseTyRef.current = translateY.value;
    } else if (touches.length === 1) {
      isDraggingRef.current = false;
      startPageXRef.current = touches[0].pageX;
      startPageYRef.current = touches[0].pageY;
      baseTxRef.current = translateX.value;
      baseTyRef.current = translateY.value;
    }
  }, [scale, translateX, translateY]);

  const handleTouchMove = useCallback((e: GestureResponderEvent) => {
    const { touches } = e.nativeEvent;

    if (isPinchingRef.current && touches.length >= 2) {
      // 双指缩放
      const dist = getDistance(touches);
      if (initialDistRef.current === 0) return;
      const newScale = baseScaleRef.current * (dist / initialDistRef.current);
      scale.value = Math.min(Math.max(newScale, 1), 5);
    } else if (touches.length === 1 && !isPinchingRef.current) {
      // 单指移动
      const dx = touches[0].pageX - startPageXRef.current;
      const dy = touches[0].pageY - startPageYRef.current;

      if (!isDraggingRef.current && (Math.abs(dx) > TAP_THRESHOLD || Math.abs(dy) > TAP_THRESHOLD)) {
        isDraggingRef.current = true;
      }

      // 放大状态下才允许平移
      if (isDraggingRef.current && scale.value > 1.05) {
        translateX.value = baseTxRef.current + dx;
        translateY.value = baseTyRef.current + dy;
      }
    }
  }, [scale, translateX, translateY]);

  const handleTouchEnd = useCallback((e: GestureResponderEvent) => {
    const { touches } = e.nativeEvent;

    if (touches.length < 2 && isPinchingRef.current) {
      isPinchingRef.current = false;
      baseScaleRef.current = scale.value;

      if (scale.value < 1.1) {
        resetAll(true);
      }
    }

    if (touches.length === 0 && !isPinchingRef.current) {
      if (!isDraggingRef.current) {
        // 单击关闭（无论是否放大）
        handleClose();
      }
      isDraggingRef.current = false;
    }
  }, [scale]);

  return (
    <>
      <View style={style}>
        <Image
          source={{ uri }}
          style={styles.thumbnail}
          resizeMode="cover"
          onTouchEnd={() => setVisible(true)}
        />
      </View>

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
          {/* pointerEvents="none" 防止 Image 拦截触摸事件 */}
          <Animated.View style={[styles.imageBox, { width: screenW, height: screenH * 0.8 }, animatedStyle]} pointerEvents="none">
            <Image
              source={{ uri }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          </Animated.View>
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
  imageBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
});
