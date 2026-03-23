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

// ─── 判断是否为点击（非拖动） ───
const TAP_THRESHOLD = 5;

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
      // 双指：开始缩放
      isPinchingRef.current = true;
      isDraggingRef.current = false;
      initialDistRef.current = getDistance(touches);
      baseScaleRef.current = scale.value;
      baseTxRef.current = translateX.value;
      baseTyRef.current = translateY.value;
    } else if (touches.length === 1) {
      // 单指：记录起点（区分点击 vs 拖动）
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
    } else if (touches.length === 1 && !isPinchingRef.current && scale.value > 1.05) {
      // 单指拖动（仅放大状态下）
      const dx = touches[0].pageX - startPageXRef.current;
      const dy = touches[0].pageY - startPageYRef.current;

      if (!isDraggingRef.current && (Math.abs(dx) > TAP_THRESHOLD || Math.abs(dy) > TAP_THRESHOLD)) {
        isDraggingRef.current = true;
      }

      if (isDraggingRef.current) {
        translateX.value = baseTxRef.current + dx;
        translateY.value = baseTyRef.current + dy;
      }
    }
  }, [scale, translateX, translateY]);

  const handleTouchEnd = useCallback((e: GestureResponderEvent) => {
    const { touches } = e.nativeEvent;

    if (touches.length < 2 && isPinchingRef.current) {
      // 双指结束
      isPinchingRef.current = false;
      baseScaleRef.current = scale.value;

      // 缩放接近 1 → 弹回原位
      if (scale.value < 1.1) {
        resetAll(true);
      }
    }

    if (touches.length === 0 && !isPinchingRef.current) {
      // 所有手指离开
      if (!isDraggingRef.current && scale.value < 1.1) {
        // 未拖动 + 未放大 → 视为单击关闭
        handleClose();
      }
      isDraggingRef.current = false;
    }
  }, [scale]);

  return (
    <>
      <View style={style}>
        <Animated.View>
          <Image
            source={{ uri }}
            style={styles.thumbnail}
            resizeMode="cover"
            onTouchEnd={() => setVisible(true)}
          />
        </Animated.View>
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
          <Animated.Image
            source={{ uri }}
            style={[{ width: screenW, height: screenH * 0.8 }, animatedStyle]}
            resizeMode="contain"
          />
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
});
