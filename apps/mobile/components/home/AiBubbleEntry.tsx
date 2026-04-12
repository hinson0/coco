import { useEffect, useRef } from "react";
import { View, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { AppText } from "../ui/AppText";
import { colors, radii, shadows } from "../../constants/theme";

function TypingDots() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createBounce = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.delay(600),
        ]),
      );

    const a1 = createBounce(dot1, 0);
    const a2 = createBounce(dot2, 200);
    const a3 = createBounce(dot3, 400);
    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  const dotStyle = (anim: Animated.Value) => ({
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -4],
        }),
      },
    ],
  });

  return (
    <View style={styles.dotsRow}>
      <Animated.View style={[styles.dot, dotStyle(dot1)]} />
      <Animated.View style={[styles.dot, dotStyle(dot2)]} />
      <Animated.View style={[styles.dot, dotStyle(dot3)]} />
    </View>
  );
}

export function AiBubbleEntry() {
  const router = useRouter();

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity activeOpacity={0.85} onPress={() => router.push("/")}>
        <LinearGradient
          colors={[colors.sagePale, "#edf6f0"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.bubble}
        >
          {/* Header row */}
          <View style={styles.header}>
            <View style={styles.aiAvatar}>
              <AppText style={styles.aiAvatarEmoji}>🤖</AppText>
            </View>
            <View>
              <AppText size="lg" weight="bold" color={colors.sage}>
                棉花助手
              </AppText>
              <AppText size="base" color={colors.textLighter}>
                随时记账，随时问
              </AppText>
            </View>
          </View>

          {/* Fake input area */}
          <View style={styles.inputArea}>
            <TypingDots />
            <AppText
              size="lg"
              color={colors.textLighter}
              style={styles.inputHint}
            >
              说点什么，或者记一笔…
            </AppText>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  bubble: {
    borderRadius: radii.xxl,
    padding: 18,
    paddingHorizontal: 20,
    ...shadows.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  aiAvatar: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    backgroundColor: colors.sage,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.sage,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  aiAvatarEmoji: {
    fontSize: 16,
  },
  inputArea: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: radii.lg,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 9999,
    backgroundColor: colors.sage,
  },
  inputHint: {
    flex: 1,
  },
});
