import { Pressable, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { router } from "expo-router";
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { QK } from "../../lib/queryKeys";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useOfflineContext } from "../../lib/offline-context";
import {
  CHAT_INITIAL_LIMIT,
  fetchChatMessages,
  fetchCategories,
} from "../../lib/db/queries";
import { colors } from "../../constants/theme";

const TAB_CONFIG: Record<string, { emoji: string; label: string }> = {
  diary: { emoji: "📋", label: "账单" },
  stats: { emoji: "📊", label: "统计" },
  "ai-placeholder": { emoji: "", label: "" },
  "auto-guide": { emoji: "🤖", label: "自动" },
  profile: { emoji: "🌿", label: "我的" },
};

function AIButton() {
  const scale = useSharedValue(1);
  const { db, userId } = useOfflineContext();
  const queryClient = useQueryClient();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // onPressIn 比 onPress 提前 ~150ms，利用此窗口预取 AI 页数据
  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.92, { damping: 15, stiffness: 200 });
    if (!db || !userId) return;
    // 缓存命中时跳过，避免每次 pressIn 都进入 prefetch 调度
    const msgsKey = [QK.chatMessages, userId, CHAT_INITIAL_LIMIT] as const;
    if (!queryClient.getQueryData(msgsKey)) {
      queryClient.prefetchQuery({
        queryKey: msgsKey,
        queryFn: () => fetchChatMessages(db, userId, CHAT_INITIAL_LIMIT),
        staleTime: Infinity,
      });
    }
    const catsKey = [QK.categories, userId] as const;
    if (!queryClient.getQueryData(catsKey)) {
      queryClient.prefetchQuery({
        queryKey: catsKey,
        queryFn: () => fetchCategories(db, userId),
        staleTime: Infinity,
      });
    }
  }, [db, userId, queryClient]);

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 200 });
      }}
      onPress={() => router.push("/")}
      style={styles.aiPressable}
    >
      <Animated.View style={animatedStyle}>
        <LinearGradient
          colors={["#5a9468", "#7ba68a", "#8fc4a0"]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={styles.aiButton}
        >
          <Text style={styles.aiText}>AI</Text>
          <Text style={styles.aiStar}>✦</Text>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

export function BottomTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  return (
    <LinearGradient
      colors={[`${colors.cream}b3`, `${colors.cream}00`]}
      start={{ x: 0, y: 1 }}
      end={{ x: 0, y: 0 }}
      style={styles.container}
    >
      {state.routes.map((route, index) => {
        const isAI = route.name === "ai-placeholder";

        if (isAI) {
          return <AIButton key={route.key} />;
        }

        const isFocused = state.index === index;
        const config = TAB_CONFIG[route.name];
        const { options } = descriptors[route.key];
        const label =
          (options.title as string | undefined) ?? config?.label ?? route.name;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={[styles.tabItem, { opacity: isFocused ? 1 : 0.35 }]}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
          >
            <Text style={styles.emoji}>{config?.emoji ?? ""}</Text>
            <Text style={styles.label}>{label}</Text>
          </Pressable>
        );
      })}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    paddingBottom: 28,
    paddingTop: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  emoji: {
    fontSize: 20,
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.text,
  },
  aiPressable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 4,
  },
  aiButton: {
    width: 56,
    height: 56,
    borderRadius: 18,
    marginTop: -18,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "rgba(123,166,138,0.35)",
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 8,
  },
  aiText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },
  aiStar: {
    color: "#ffd700",
    fontSize: 8,
    position: "absolute",
    top: 8,
    right: 10,
  },
});
