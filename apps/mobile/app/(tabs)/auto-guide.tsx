import { Image } from "expo-image";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GuideImage } from "../../components/auto/GuideImage";
import { SetupStep } from "../../components/auto/SetupStep";
import { AppText } from "../../components/ui/AppText";
import { Card } from "../../components/ui/Card";
import { colors, radii } from "../../constants/theme";
import { useAutoBookkeepingStatus } from "../../hooks/useAutoBookkeepingStatus";
import { AutoBookkeeping } from "../../lib/auto-bookkeeping";

const guideNotifListener1 = require("../../assets/guides/notif-listener-1.png");
const guideNotifListener2 = require("../../assets/guides/notif-listener-2.png");
const guideDemoResult = require("../../assets/guides/demo-result.png");

export default function AutoBookkeepingScreen() {
  const insets = useSafeAreaInsets();
  const { listenerGranted, notifEnabled, channelEnabled } =
    useAutoBookkeepingStatus();
  const notifFullyConfigured = notifEnabled && channelEnabled;

  if (Platform.OS !== "android") {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <StatusBar style="dark" backgroundColor={colors.cream} />
        <View style={styles.centerContent}>
          <AppText size="3xl">📱</AppText>
          <AppText
            size="2xl"
            color={colors.textLight}
            style={styles.centerText}
          >
            自动记账仅支持 Android 设备
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="dark" backgroundColor={colors.cream} />

      <View style={styles.header}>
        <AppText size="5xl" weight="bold" color={colors.text}>
          自动记账
        </AppText>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SetupStep
          step={1}
          title="通知监听"
          done={listenerGranted}
          buttonLabel="去开启"
          onPress={() => AutoBookkeeping?.openPermissionSettings()}
        >
          <AppText size="md" color={colors.textLight} style={styles.stepDesc}>
            允许 CoCo 读取微信和支付宝的支付通知，用于自动识别金额
          </AppText>
          <GuideImage
            source={guideNotifListener1}
            label="参考：找到 CoCo AI记账（小米手机）"
          />
          <GuideImage
            source={guideNotifListener2}
            label="参考：确认授权（小米手机）"
          />
        </SetupStep>

        {listenerGranted && !notifFullyConfigured ? (
          <TouchableOpacity
            style={styles.tipBar}
            onPress={() => router.push("/smarter-coco")}
            activeOpacity={0.7}
          >
            <AppText size="md" color={colors.text} style={styles.tipText}>
              ✨ 解锁进阶能力，让自动记账更稳定
            </AppText>
            <AppText size="md" weight="semibold" color={colors.sage}>
              去优化 ›
            </AppText>
          </TouchableOpacity>
        ) : null}

        {/* 支持的应用 */}
        <View style={styles.section}>
          <AppText
            size="xl"
            weight="semibold"
            color={colors.text}
            style={styles.sectionTitle}
          >
            支持的应用
          </AppText>
          <Card style={styles.appsCard}>
            <View style={styles.appRow}>
              <AppText size="2xl">💬</AppText>
              <AppText size="2xl" color={colors.text}>
                微信支付
              </AppText>
            </View>
            <View style={styles.divider} />
            <View style={styles.appRow}>
              <AppText size="2xl">🔵</AppText>
              <AppText size="2xl" color={colors.text}>
                支付宝
              </AppText>
            </View>
          </Card>
        </View>

        {/* 工作原理 */}
        <View style={styles.section}>
          <AppText
            size="xl"
            weight="semibold"
            color={colors.text}
            style={styles.sectionTitle}
          >
            工作原理
          </AppText>
          <Card style={styles.howCard}>
            <View style={styles.howRow}>
              <AppText size="2xl">1️⃣</AppText>
              <AppText
                size="md"
                color={colors.textLight}
                style={styles.howText}
              >
                你用微信或支付宝完成付款
              </AppText>
            </View>
            <View style={styles.howRow}>
              <AppText size="2xl">2️⃣</AppText>
              <AppText
                size="md"
                color={colors.textLight}
                style={styles.howText}
              >
                CoCo 自动识别支付通知中的金额
              </AppText>
            </View>
            <View style={styles.howRow}>
              <AppText size="2xl">3️⃣</AppText>
              <AppText
                size="md"
                color={colors.textLight}
                style={styles.howText}
              >
                自动记账并标记来源，在聊天页查看记录
              </AppText>
            </View>
          </Card>
          <AppText
            size="xl"
            weight="semibold"
            color={colors.text}
            style={styles.demoLabel}
          >
            效果如图：
          </AppText>
          <Image
            source={guideDemoResult}
            style={styles.demoImage}
            contentFit="contain"
          />
        </View>

        {/* 调试按钮 */}
        {__DEV__ ? (
          <TouchableOpacity
            style={styles.debugBtn}
            activeOpacity={0.8}
            onPress={() => {
              if (!AutoBookkeeping) return;
              const info = AutoBookkeeping.getDebugInfo();
              const buffer = AutoBookkeeping.getAndClearBuffer();
              Alert.alert(
                "NLS 调试",
                `服务: ${info.serviceConnected} | 模块: ${info.moduleRegistered}\n` +
                  `通知: ${info.watchedNotifications} | 本地已发: ${info.localNotifSent}\n` +
                  `错误: ${info.localNotifError || "无"}\n` +
                  `缓冲: ${buffer.length}\n` +
                  `最后: ${info.lastPkg}\n${info.lastTitle}: ${info.lastText}`,
              );
            }}
          >
            <AppText size="md" color={colors.textLight}>
              调试信息
            </AppText>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  centerText: { textAlign: "center" },

  stepDesc: {
    marginTop: 10,
    lineHeight: 20,
  },

  tipBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.sagePale,
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 16,
  },
  tipText: { flex: 1, marginRight: 8 },

  // Sections
  section: { marginTop: 8, marginBottom: 20 },
  sectionTitle: { marginBottom: 10 },
  appsCard: { gap: 0 },
  appRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
  },
  divider: {
    height: 1,
    backgroundColor: colors.creamDark,
    marginVertical: 4,
  },
  howCard: { gap: 12 },
  howRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  howText: { flex: 1 },
  demoLabel: {
    marginTop: 16,
    marginBottom: 4,
  },
  demoImage: {
    width: "100%",
    aspectRatio: 0.52,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.creamDark,
    marginTop: 12,
  },
  debugBtn: {
    alignItems: "center",
    paddingVertical: 16,
    marginTop: 12,
    marginBottom: 20,
  },
});
