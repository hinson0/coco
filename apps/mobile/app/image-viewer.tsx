import { useRef, useCallback, useEffect } from 'react';
import { View, Image, StyleSheet, TouchableOpacity, Alert, StatusBar, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { AppText } from '../components/ui/AppText';
import { colors, spacing } from '../constants/theme';

// ─── 两点距离 ───
function getDistance(touches: GestureResponderEvent['nativeEvent']['touches']) {
  if (touches.length < 2) return 0;
  const [a, b] = touches;
  return Math.sqrt((a.pageX - b.pageX) ** 2 + (a.pageY - b.pageY) ** 2);
}

const TAP_THRESHOLD = 8;
const ANIM_DURATION = 280;

export default function ImageViewerScreen() {
  const params = useLocalSearchParams<{
    uri: string;
    thumbX: string;
    thumbY: string;
    thumbW: string;
    thumbH: string;
  }>();
  const uri = params.uri;
  const thumbX = Number(params.thumbX) || 0;
  const thumbY = Number(params.thumbY) || 0;
  const thumbW = Number(params.thumbW) || 160;
  const thumbH = Number(params.thumbH) || 120;

  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();

  // ─── 转场动画值 ───
  // progress: 0 = 缩略图位置, 1 = 全屏
  const progress = useSharedValue(0);
  const bgOpacity = useSharedValue(0);
  const toolbarOpacity = useSharedValue(0);

  // 全屏时图片的目标中心
  const fullCenterX = screenW / 2;
  const fullCenterY = screenH / 2;
  // 缩略图中心
  const thumbCenterX = thumbX + thumbW / 2;
  const thumbCenterY = thumbY + thumbH / 2;
  // 缩略图相对全屏的缩放比例
  const thumbScale = thumbW / screenW;

  // 入场动画
  useEffect(() => {
    progress.value = withTiming(1, { duration: ANIM_DURATION });
    bgOpacity.value = withTiming(1, { duration: ANIM_DURATION });
    toolbarOpacity.value = withTiming(1, { duration: ANIM_DURATION });
  }, []);

  // 图片转场样式：从缩略图位置插值到全屏
  const imageTransitionStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const currentScale = thumbScale + (1 - thumbScale) * p;
    const currentX = thumbCenterX + (fullCenterX - thumbCenterX) * p;
    const currentY = thumbCenterY + (fullCenterY - thumbCenterY) * p;
    // 将位置转换为 translate（相对于全屏中心的偏移）
    const tx = currentX - fullCenterX;
    const ty = currentY - fullCenterY;

    return {
      transform: [
        { translateX: tx + panTx.value },
        { translateY: ty + panTy.value },
        { scale: currentScale * pinchScale.value },
      ],
    };
  });

  const bgAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(0,0,0,${bgOpacity.value})`,
  }));

  const toolbarAnimatedStyle = useAnimatedStyle(() => ({
    opacity: toolbarOpacity.value,
  }));

  // ─── 双指缩放 ───
  const pinchScale = useSharedValue(1);
  const basePinchRef = useRef(1);
  const initialDistRef = useRef(0);
  const isPinchingRef = useRef(false);

  // ─── 单指平移 ───
  const panTx = useSharedValue(0);
  const panTy = useSharedValue(0);
  const basePanTxRef = useRef(0);
  const basePanTyRef = useRef(0);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const justPinchedRef = useRef(false);
  const isClosingRef = useRef(false);

  function animateClose() {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    // 重置平移和额外缩放，让图片回到「干净」的全屏状态
    panTx.value = withTiming(0, { duration: ANIM_DURATION });
    panTy.value = withTiming(0, { duration: ANIM_DURATION });
    pinchScale.value = withTiming(1, { duration: ANIM_DURATION });
    // 从全屏收回缩略图位置
    progress.value = withTiming(0, { duration: ANIM_DURATION });
    bgOpacity.value = withTiming(0, { duration: ANIM_DURATION }, () => {
      runOnJS(router.back)();
    });
    toolbarOpacity.value = withTiming(0, { duration: 120 });
  }

  // ─── 触摸事件 ───
  const onTouchStart = useCallback((e: GestureResponderEvent) => {
    if (isClosingRef.current) return;
    const { touches } = e.nativeEvent;
    if (touches.length === 2) {
      isPinchingRef.current = true;
      isDraggingRef.current = false;
      initialDistRef.current = getDistance(touches);
      basePinchRef.current = pinchScale.value;
      basePanTxRef.current = panTx.value;
      basePanTyRef.current = panTy.value;
    } else if (touches.length === 1) {
      isDraggingRef.current = false;
      startXRef.current = touches[0].pageX;
      startYRef.current = touches[0].pageY;
      basePanTxRef.current = panTx.value;
      basePanTyRef.current = panTy.value;
    }
  }, [pinchScale, panTx, panTy]);

  const onTouchMove = useCallback((e: GestureResponderEvent) => {
    if (isClosingRef.current) return;
    const { touches } = e.nativeEvent;
    if (isPinchingRef.current && touches.length >= 2) {
      const dist = getDistance(touches);
      if (initialDistRef.current === 0) return;
      pinchScale.value = Math.min(Math.max(basePinchRef.current * (dist / initialDistRef.current), 1), 5);
    } else if (touches.length === 1 && !isPinchingRef.current) {
      const dx = touches[0].pageX - startXRef.current;
      const dy = touches[0].pageY - startYRef.current;
      if (!isDraggingRef.current && (Math.abs(dx) > TAP_THRESHOLD || Math.abs(dy) > TAP_THRESHOLD)) {
        isDraggingRef.current = true;
      }
      if (isDraggingRef.current && pinchScale.value > 1.05) {
        panTx.value = basePanTxRef.current + dx;
        panTy.value = basePanTyRef.current + dy;
      }
    }
  }, [pinchScale, panTx, panTy]);

  const onTouchEnd = useCallback((e: GestureResponderEvent) => {
    if (isClosingRef.current) return;
    const { touches } = e.nativeEvent;

    if (touches.length < 2 && isPinchingRef.current) {
      isPinchingRef.current = false;
      justPinchedRef.current = true;
      basePinchRef.current = pinchScale.value;
      if (pinchScale.value < 1.1) {
        pinchScale.value = withTiming(1, { duration: 150 });
        panTx.value = withTiming(0, { duration: 150 });
        panTy.value = withTiming(0, { duration: 150 });
        basePinchRef.current = 1;
      }
      return;
    }

    if (touches.length === 0) {
      if (justPinchedRef.current) {
        justPinchedRef.current = false;
      } else if (!isDraggingRef.current) {
        animateClose();
      }
      isDraggingRef.current = false;
    }
  }, [pinchScale, panTx, panTy]);

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

      <Animated.View
        style={[styles.imageArea, bgAnimatedStyle]}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <Animated.View
          style={[{ width: screenW, height: screenH * 0.85 }, imageTransitionStyle]}
          pointerEvents="none"
        >
          <Image source={{ uri }} style={styles.fullImage} resizeMode="contain" />
        </Animated.View>
      </Animated.View>

      <Animated.View style={[styles.toolbar, { paddingBottom: insets.bottom + spacing.md }, toolbarAnimatedStyle]}>
        <TouchableOpacity onPress={handleShare} style={styles.toolBtn}>
          <AppText size="2xl">↗</AppText>
          <AppText size="sm" color={colors.white}>分享</AppText>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSave} style={styles.toolBtn}>
          <AppText size="2xl">⬇</AppText>
          <AppText size="sm" color={colors.white}>保存</AppText>
        </TouchableOpacity>
      </Animated.View>
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
