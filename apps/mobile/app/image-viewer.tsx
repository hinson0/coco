import { useRef, useCallback, useEffect } from 'react';
import { View, Image, StyleSheet, TouchableOpacity, Alert, StatusBar, type GestureResponderEvent } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS } from 'react-native-reanimated';
import { AppText } from '../components/ui/AppText';
import { colors, spacing } from '../constants/theme';

// ─── 两点距离 ───
function getDistance(touches: GestureResponderEvent['nativeEvent']['touches']) {
  if (touches.length < 2) return 0;
  const [a, b] = touches;
  return Math.sqrt((a.pageX - b.pageX) ** 2 + (a.pageY - b.pageY) ** 2);
}

const TAP_THRESHOLD = 8;

export default function ImageViewerScreen() {
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const insets = useSafeAreaInsets();

  // 进入/退出动画
  const enterScale = useSharedValue(0.5);
  const enterOpacity = useSharedValue(0);
  const isClosingRef = useRef(false);

  useEffect(() => {
    enterScale.value = withSpring(1, { damping: 20, stiffness: 200, mass: 0.5 });
    enterOpacity.value = withTiming(1, { duration: 250 });
  }, []);

  function animateClose() {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    enterScale.value = withTiming(0.5, { duration: 200 });
    enterOpacity.value = withTiming(0, { duration: 200 }, () => {
      runOnJS(router.back)();
    });
  }

  const enterAnimStyle = useAnimatedStyle(() => ({
    opacity: enterOpacity.value,
    transform: [{ scale: enterScale.value }],
  }));

  // 背景跟随图片淡入淡出
  const bgAnimStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(0,0,0,${enterOpacity.value})`,
  }));

  // 缩放
  const scale = useSharedValue(1);
  const baseScaleRef = useRef(1);
  const initialDistRef = useRef(0);
  const isPinchingRef = useRef(false);

  // 平移
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const baseTxRef = useRef(0);
  const baseTyRef = useRef(0);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isDraggingRef = useRef(false);
  // pinch 结束后短暂冷却，防止第二根手指抬起被误判为单击
  const justPinchedRef = useRef(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const springConfig = { damping: 20, stiffness: 200, mass: 0.5 };

  function resetTransform(animated = true) {
    scale.value = animated ? withSpring(1, springConfig) : 1;
    translateX.value = animated ? withSpring(0, springConfig) : 0;
    translateY.value = animated ? withSpring(0, springConfig) : 0;
    baseScaleRef.current = 1;
    baseTxRef.current = 0;
    baseTyRef.current = 0;
  }

  // ─── 触摸事件 ───
  const onTouchStart = useCallback((e: GestureResponderEvent) => {
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
      startXRef.current = touches[0].pageX;
      startYRef.current = touches[0].pageY;
      baseTxRef.current = translateX.value;
      baseTyRef.current = translateY.value;
    }
  }, [scale, translateX, translateY]);

  const onTouchMove = useCallback((e: GestureResponderEvent) => {
    const { touches } = e.nativeEvent;
    if (isPinchingRef.current && touches.length >= 2) {
      const dist = getDistance(touches);
      if (initialDistRef.current === 0) return;
      const raw = Math.min(Math.max(baseScaleRef.current * (dist / initialDistRef.current), 1), 5);
      scale.value = withSpring(raw, { damping: 40, stiffness: 300, mass: 0.5 });
    } else if (touches.length === 1 && !isPinchingRef.current) {
      const dx = touches[0].pageX - startXRef.current;
      const dy = touches[0].pageY - startYRef.current;
      if (!isDraggingRef.current && (Math.abs(dx) > TAP_THRESHOLD || Math.abs(dy) > TAP_THRESHOLD)) {
        isDraggingRef.current = true;
      }
      if (isDraggingRef.current && scale.value > 1.05) {
        translateX.value = baseTxRef.current + dx;
        translateY.value = baseTyRef.current + dy;
      }
    }
  }, [scale, translateX, translateY]);

  const onTouchEnd = useCallback((e: GestureResponderEvent) => {
    const { touches } = e.nativeEvent;

    if (touches.length < 2 && isPinchingRef.current) {
      // 第一根手指抬起，pinch 结束
      isPinchingRef.current = false;
      justPinchedRef.current = true;
      baseScaleRef.current = scale.value;
      if (scale.value < 1.1) resetTransform(true);
      return;
    }

    if (touches.length === 0) {
      if (justPinchedRef.current) {
        // 第二根手指抬起（pinch 刚结束），不关闭
        justPinchedRef.current = false;
      } else if (!isDraggingRef.current) {
        // 真正的单击 → 返回
        animateClose();
      }
      isDraggingRef.current = false;
    }
  }, [scale]);

  // ─── 操作按钮 ───
  async function handleSave() {
    if (!uri) return;
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('需要相册权限', '请在系统设置中允许访问相册');
      return;
    }
    try {
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('已保存', '图片已保存到相册');
    } catch {
      Alert.alert('保存失败', '请重试');
    }
  }

  async function handleShare() {
    if (!uri || !(await Sharing.isAvailableAsync())) return;
    await Sharing.shareAsync(uri);
  }

  if (!uri) {
    router.back();
    return null;
  }

  return (
    <Animated.View style={[styles.screen, bgAnimStyle]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* 图片区域（外层 enterAnimStyle 控制进入/退出，内层 animatedStyle 控制缩放平移） */}
      <Animated.View style={[styles.imageArea, enterAnimStyle]}>
        <View
          style={styles.imageArea}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <Animated.View style={[styles.imageBox, animatedStyle]} pointerEvents="none">
            <Image source={{ uri }} style={styles.fullImage} resizeMode="contain" />
          </Animated.View>
        </View>
      </Animated.View>

      {/* 底部操作栏 */}
      <View style={[styles.toolbar, { paddingBottom: insets.bottom + spacing.md }]}>
        <TouchableOpacity onPress={handleShare} style={styles.toolBtn}>
          <AppText size="2xl">↗</AppText>
          <AppText size="sm" color={colors.white}>分享</AppText>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSave} style={styles.toolBtn}>
          <AppText size="2xl">⬇</AppText>
          <AppText size="sm" color={colors.white}>保存</AppText>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  imageArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageBox: {
    width: '100%',
    height: '100%',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingVertical: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  toolBtn: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xxl,
  },
});
