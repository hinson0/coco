import { useRef, useCallback } from 'react';
import { View, Image, StyleSheet, TouchableOpacity, Alert, StatusBar, useWindowDimensions, type GestureResponderEvent } from 'react-native';
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
  const { width: screenW, height: screenH } = useWindowDimensions();

  // ─── 双指缩放 + 单指平移（在查看时使用，不影响转场） ───
  const pinchScale = useSharedValue(1);
  const panTx = useSharedValue(0);
  const panTy = useSharedValue(0);

  const basePinchRef = useRef(1);
  const initialDistRef = useRef(0);
  const isPinchingRef = useRef(false);
  const basePanTxRef = useRef(0);
  const basePanTyRef = useRef(0);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const justPinchedRef = useRef(false);

  const gestureStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: panTx.value },
      { translateY: panTy.value },
      { scale: pinchScale.value },
    ],
  }));

  // ─── 触摸事件 ───
  const onTouchStart = useCallback((e: GestureResponderEvent) => {
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
        // 单击返回 — 先重置缩放/平移，再 router.back()
        // reanimated 的 sharedTransitionTag 自动处理缩回动画
        pinchScale.value = withTiming(1, { duration: 150 });
        panTx.value = withTiming(0, { duration: 150 });
        panTy.value = withTiming(0, { duration: 150 });
        // 短暂延迟让手势重置完成，再触发页面返回转场
        setTimeout(() => router.back(), 80);
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

      {/* 图片区域 */}
      <View
        style={styles.imageArea}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <Animated.View style={[styles.gestureContainer, gestureStyle]} pointerEvents="none">
          {/* sharedTransitionTag 与 ImagePreview 中的一致，reanimated 自动处理转场 */}
          <Animated.Image
            sharedTransitionTag={`image-${uri}`}
            source={{ uri }}
            style={{ width: screenW, height: screenH * 0.85 }}
            resizeMode="contain"
          />
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
  gestureContainer: {
    alignItems: 'center',
    justifyContent: 'center',
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
