import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../../components/ui/AppText";
import { Card } from "../../components/ui/Card";
import { PulseDot } from "../../components/ui/PulseDot";
import { colors, radii, spacing } from "../../constants/theme";
import {
  getDeviceBrand,
  getBrandGuideSteps,
} from "../../lib/auto-bookkeeping/brand-detection";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const guideNotifListener = require("../../assets/guides/notif-listener.png");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const guideNotifMain = require("../../assets/guides/notif-main.png");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const guideNotifChannel = require("../../assets/guides/notif-channel.png");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const guideAutoStart = require("../../assets/guides/app-autostart.png");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const guideBattery = require("../../assets/guides/battery-unlimited.png");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const guideDemoResult = require("../../assets/guides/demo-result.png");

let AutoBookkeeping:
  | typeof import("../../../../modules/expo-auto-bookkeeping/src/ExpoAutoBookkeeping")
  | null = null;
if (Platform.OS === "android") {
  try {
    AutoBookkeeping = require("../../../../modules/expo-auto-bookkeeping/src/ExpoAutoBookkeeping");
  } catch {}
}

// ─── Guide image ─────────────────────────────────────────────────────────────

function GuideImage({ source, label }: { source: number; label: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.guideImageWrap}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setExpanded(!expanded)}
        style={styles.guideImageBtn}
      >
        <AppText size="sm" color={colors.sage}>
          {expanded ? "▼" : "▶"} {label}
        </AppText>
      </TouchableOpacity>
      {expanded ? (
        <Image source={source} style={styles.guideImage} contentFit="contain" />
      ) : null}
    </View>
  );
}

// ─── Step card ───────────────────────────────────────────────────────────────

interface SetupStepProps {
  readonly step: number;
  readonly title: string;
  readonly done: boolean;
  readonly onPress: () => void;
  readonly buttonLabel: string;
  readonly children?: React.ReactNode;
}

function SetupStep({
  step,
  title,
  done,
  onPress,
  buttonLabel,
  children,
}: SetupStepProps) {
  return (
    <Card style={styles.stepCard}>
      <TouchableOpacity
        style={styles.stepHeader}
        activeOpacity={0.7}
        onPress={onPress}
      >
        <View style={styles.stepLeft}>
          <View style={[styles.stepNumber, done && styles.stepNumberDone]}>
            <AppText size="base" weight="bold" color={colors.white}>
              {step}
            </AppText>
          </View>
          <AppText size="lg" weight="semibold" color={colors.text}>
            {title}
          </AppText>
        </View>
        {done ? (
          <View style={styles.runningTag}>
            <PulseDot size={8} />
            <AppText size="base" weight="medium" color={colors.sage}>
              运行中
            </AppText>
          </View>
        ) : null}
      </TouchableOpacity>
      {!done ? (
        <View style={styles.stepBody}>
          {children}
          <TouchableOpacity
            style={styles.stepBtn}
            activeOpacity={0.8}
            onPress={onPress}
          >
            <AppText size="base" weight="semibold" color={colors.white}>
              {buttonLabel}
            </AppText>
          </TouchableOpacity>
        </View>
      ) : null}
    </Card>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function AutoBookkeepingScreen() {
  const insets = useSafeAreaInsets();
  const [listenerGranted, setListenerGranted] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [channelEnabled, setChannelEnabled] = useState(false);

  const checkAll = useCallback(() => {
    if (!AutoBookkeeping) return;
    setListenerGranted(AutoBookkeeping.isPermissionGranted());
    setNotifEnabled(AutoBookkeeping.areNotificationsEnabled());
    setChannelEnabled(AutoBookkeeping.isChannelEnabled());
  }, []);

  useEffect(() => {
    checkAll();
    const interval = setInterval(checkAll, 3000);
    return () => clearInterval(interval);
  }, [checkAll]);

  const allDone = listenerGranted && notifEnabled && channelEnabled;
  const brand = getDeviceBrand();
  const guideSteps = getBrandGuideSteps(brand);

  if (Platform.OS !== "android") {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <StatusBar style="dark" backgroundColor={colors.cream} />
        <View style={styles.centerContent}>
          <AppText size="3xl">📱</AppText>
          <AppText size="xl" color={colors.textLight} style={styles.centerText}>
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
        {allDone ? (
          <View style={styles.headerStatus}>
            <PulseDot size={8} />
            <AppText size="base" weight="medium" color={colors.sage}>
              全部就绪
            </AppText>
          </View>
        ) : null}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* 三步设置 */}
        <SetupStep
          step={1}
          title="通知监听"
          done={listenerGranted}
          buttonLabel="去开启"
          onPress={() => AutoBookkeeping?.openPermissionSettings()}
        >
          <AppText size="base" color={colors.textLight} style={styles.stepDesc}>
            允许 CoCo 读取微信和支付宝的支付通知，用于自动识别金额
          </AppText>
          <GuideImage
            source={guideNotifListener}
            label="参考：开启通知使用权（小米手机）"
          />
        </SetupStep>

        <SetupStep
          step={2}
          title="通知权限"
          done={notifEnabled && channelEnabled}
          buttonLabel="去设置"
          onPress={() => AutoBookkeeping?.openNotificationSettings()}
        >
          <AppText size="base" color={colors.textLight} style={styles.stepDesc}>
            开启「允许通知」和「悬浮通知」
          </AppText>
          <GuideImage
            source={guideNotifMain}
            label="参考：通知主设置（小米手机）"
          />
          <AppText size="base" color={colors.textLight} style={styles.stepDesc}>
            进入「自动记账」通知渠道，开启「悬浮通知」
          </AppText>
          <GuideImage
            source={guideNotifChannel}
            label="参考：自动记账渠道设置（小米手机）"
          />
        </SetupStep>

        <SetupStep
          step={3}
          title="后台运行"
          done={allDone}
          buttonLabel="去设置"
          onPress={() => AutoBookkeeping?.openAutoStartSettings()}
        >
          <AppText size="base" color={colors.textLight} style={styles.stepDesc}>
            开启自启动，确保 CoCo 在后台持续运行
          </AppText>
          <GuideImage
            source={guideAutoStart}
            label="参考：开启自启动（小米手机）"
          />
          <AppText size="base" color={colors.textLight} style={styles.stepDesc}>
            电量策略选择「无限制」，防止系统杀后台
          </AppText>
          <GuideImage
            source={guideBattery}
            label="参考：电量策略选「无限制」（小米手机）"
          />
        </SetupStep>

        {/* 支持的应用 */}
        <View style={styles.section}>
          <AppText
            size="lg"
            weight="semibold"
            color={colors.text}
            style={styles.sectionTitle}
          >
            支持的应用
          </AppText>
          <Card style={styles.appsCard}>
            <View style={styles.appRow}>
              <AppText size="2xl">💬</AppText>
              <AppText size="xl" color={colors.text}>
                微信支付
              </AppText>
            </View>
            <View style={styles.divider} />
            <View style={styles.appRow}>
              <AppText size="2xl">🔵</AppText>
              <AppText size="xl" color={colors.text}>
                支付宝
              </AppText>
            </View>
          </Card>
        </View>

        {/* 工作原理 */}
        <View style={styles.section}>
          <AppText
            size="lg"
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
                size="base"
                color={colors.textLight}
                style={styles.howText}
              >
                你用微信或支付宝完成付款
              </AppText>
            </View>
            <View style={styles.howRow}>
              <AppText size="2xl">2️⃣</AppText>
              <AppText
                size="base"
                color={colors.textLight}
                style={styles.howText}
              >
                CoCo 自动识别支付通知中的金额
              </AppText>
            </View>
            <View style={styles.howRow}>
              <AppText size="2xl">3️⃣</AppText>
              <AppText
                size="base"
                color={colors.textLight}
                style={styles.howText}
              >
                自动记账并标记来源，在聊天页查看记录
              </AppText>
            </View>
          </Card>
          <AppText
            size="lg"
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
            <AppText size="base" color={colors.textLight}>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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

  // Setup steps
  stepCard: { marginBottom: 12 },
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.textLighter,
    justifyContent: "center",
    alignItems: "center",
  },
  stepNumberDone: {
    backgroundColor: colors.sage,
  },
  runningTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  stepBody: {
    marginLeft: 34,
  },
  stepDesc: {
    marginTop: 10,
    lineHeight: 20,
  },
  stepBtn: {
    marginTop: 12,
    backgroundColor: colors.sage,
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: "flex-start",
  },

  // Guide images
  guideImageWrap: {
    marginTop: 8,
  },
  guideImageBtn: {
    paddingVertical: 6,
  },
  guideImage: {
    width: "100%",
    aspectRatio: 0.5,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.creamDark,
    marginTop: 6,
  },

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
