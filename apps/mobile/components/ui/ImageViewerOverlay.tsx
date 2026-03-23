import { useRef, useCallback, createContext, useContext, useState, type ReactNode } from 'react';
import { View, Image, StyleSheet, TouchableOpacity, Alert, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, runOnJS } from 'react-native-reanimated';
import { AppText } from './AppText';
import { colors, spacing } from '../../constants/theme';

// ─── Context ───
interface ImageViewerState {
  open: (uri: string, layout: { x: number; y: number; w: number; h: number }) => void;
  /** 当前正在预览的 URI，缩略图据此隐藏自己 */
  activeUri: string | null;
}

const ImageViewerContext = createContext<ImageViewerState | null>(null);

export function useImageViewer() {
  const ctx = useContext(ImageViewerContext);
  if (!ctx) throw new Error('useImageViewer must be inside ImageViewerProvider');
  return ctx;
}

// ─── 两点距离 ───
function getDistance(touches: GestureResponderEvent['nativeEvent']['touches']) {
  if (touches.length < 2) return 0;
  const [a, b] = touches;
  return Math.sqrt((a.pageX - b.pageX) ** 2 + (a.pageY - b.pageY) ** 2);
}

const TAP_THRESHOLD = 8;
const EASING = Easing.bezier(0.25, 0.1, 0.25, 1); // iOS 标准缓动
const DURATION = 300;

// ─── Provider + Overlay ───
export function ImageViewerProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [imageUri, setImageUri] = useState('');
  const [activeUri, setActiveUri] = useState<string | null>(null);
  const thumbRect = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // 动画进度 0 = 缩略图位置/大小, 1 = 全屏
  const progress = useSharedValue(0);
  // 手势：缩放 + 平移
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
  const isClosingRef = useRef(false);

  // ─── 打开 ───
  const open = useCallback((uri: string, layout: { x: number; y: number; w: number; h: number }) => {
    setImageUri(uri);
    setActiveUri(uri);  // 隐藏原始缩略图
    thumbRect.current = layout;
    isClosingRef.current = false;

    // 重置手势状态
    pinchScale.value = 1;
    panTx.value = 0;
    panTy.value = 0;
    progress.value = 0;

    setVisible(true);
    // 下一帧启动动画
    requestAnimationFrame(() => {
      progress.value = withTiming(1, { duration: DURATION, easing: EASING });
    });
  }, [progress, pinchScale, panTx, panTy]);

  // ─── 关闭 ───
  function close() {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    // 先重置手势
    pinchScale.value = withTiming(1, { duration: 200, easing: EASING });
    panTx.value = withTiming(0, { duration: 200, easing: EASING });
    panTy.value = withTiming(0, { duration: 200, easing: EASING });

    // 缩回缩略图位置，动画完成后恢复缩略图 + 移除覆盖层
    progress.value = withTiming(0, { duration: DURATION, easing: EASING }, () => {
      runOnJS(setActiveUri)(null);  // 恢复原始缩略图可见
      runOnJS(setVisible)(false);
    });
  }

  // ─── 动画样式 ───
  const { x: tx, y: ty, w: tw, h: th } = thumbRect.current;
  // 全屏时容器覆盖整个屏幕（cover 模式下图片填满）
  const fullW = screenW;
  const fullH = screenH;
  const fullX = 0;
  const fullY = 0;

  // 缩略图圆角（匹配 OcrBubble 的 radii.lg = 18）
  const THUMB_RADIUS = 18;

  const imageAnimatedStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const curX = tx + (fullX - tx) * p;
    const curY = ty + (fullY - ty) * p;
    const curW = tw + (fullW - tw) * p;
    const curH = th + (fullH - th) * p;
    // 圆角：缩略图 18 → 全屏 0
    const curRadius = THUMB_RADIUS * (1 - p);

    return {
      position: 'absolute',
      left: curX,
      top: curY,
      width: curW,
      height: curH,
      borderRadius: curRadius,
      overflow: 'hidden' as const,
      transform: [
        { translateX: panTx.value },
        { translateY: panTy.value },
        { scale: pinchScale.value },
      ],
    };
  });

  const bgAnimatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const toolbarAnimatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  // ─── 触摸手势 ───
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
        close();
      }
      isDraggingRef.current = false;
    }
  }, [pinchScale, panTx, panTy]);

  // ─── 操作按钮 ───
  async function handleShare() {
    if (!imageUri || !(await Sharing.isAvailableAsync())) return;
    await Sharing.shareAsync(imageUri);
  }

  return (
    <ImageViewerContext.Provider value={{ open, activeUri }}>
      {children}

      {visible && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* 黑色背景 */}
          <Animated.View style={[styles.bg, bgAnimatedStyle]} />

          {/* 触摸区域 */}
          <View
            style={StyleSheet.absoluteFill}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <Animated.View style={imageAnimatedStyle} pointerEvents="none">
              <Image source={{ uri: imageUri }} style={styles.fullImage} resizeMode="cover" />
            </Animated.View>
          </View>

          {/* 工具栏 */}
          <Animated.View
            style={[styles.toolbar, { paddingBottom: insets.bottom + spacing.md }, toolbarAnimatedStyle]}
            pointerEvents="box-none"
          >
            <TouchableOpacity onPress={handleShare} style={styles.toolBtn}>
              <AppText size="2xl">↗</AppText>
              <AppText size="sm" color={colors.white}>分享</AppText>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}
    </ImageViewerContext.Provider>
  );
}

const styles = StyleSheet.create({
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  toolbar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
