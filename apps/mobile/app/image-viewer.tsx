import { useRef, useCallback } from 'react';
import { View, Image, StyleSheet, TouchableOpacity, Alert, StatusBar, type GestureResponderEvent } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
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

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  function resetTransform(animated = true) {
    const opts = { duration: 150 };
    scale.value = animated ? withTiming(1, opts) : 1;
    translateX.value = animated ? withTiming(0, opts) : 0;
    translateY.value = animated ? withTiming(0, opts) : 0;
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
      scale.value = Math.min(Math.max(baseScaleRef.current * (dist / initialDistRef.current), 1), 5);
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
      isPinchingRef.current = false;
      baseScaleRef.current = scale.value;
      if (scale.value < 1.1) resetTransform(true);
    }
    if (touches.length === 0 && !isPinchingRef.current) {
      if (!isDraggingRef.current) {
        router.back();
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
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* 图片区域 */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
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
