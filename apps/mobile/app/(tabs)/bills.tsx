import { StatusBar } from "expo-status-bar";
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
import { colors, radii, shadows, spacing } from "../../constants/theme";
import { usePendingCount } from "../../hooks/usePendingNotifications";
import {
  getDeviceBrand,
  getBrandGuideSteps,
} from "../../lib/auto-bookkeeping/brand-detection";

let AutoBookkeeping:
  | typeof import("../../../../modules/expo-auto-bookkeeping/src/ExpoAutoBookkeeping")
  | null = null;
if (Platform.OS === "android") {
  try {
    AutoBookkeeping = require("../../../../modules/expo-auto-bookkeeping/src/ExpoAutoBookkeeping");
  } catch {}
}

export default function AutoBookkeepingScreen() {
  const insets = useSafeAreaInsets();
  const [permissionGranted, setPermissionGranted] = useState(false);
  const { data: pendingCount = 0 } = usePendingCount();

  const checkPermission = useCallback(() => {
    if (!AutoBookkeeping) return;
    setPermissionGranted(AutoBookkeeping.isPermissionGranted());
  }, []);

  useEffect(() => {
    checkPermission();
    const interval = setInterval(checkPermission, 3000);
    return () => clearInterval(interval);
  }, [checkPermission]);

  const brand = getDeviceBrand();
  const guideSteps = getBrandGuideSteps(brand);

  const handleOpenSettings = () => {
    if (!AutoBookkeeping) {
      Alert.alert("调试", "原生模块未加载，AutoBookkeeping 为 null");
      return;
    }
    AutoBookkeeping.openPermissionSettings();
  };

  const handleDebug = () => {
    if (!AutoBookkeeping) {
      Alert.alert("调试", "模块未加载");
      return;
    }
    const info = AutoBookkeeping.getDebugInfo();
    Alert.alert(
      "NLS 调试信息",
      `服务连接: ${info.serviceConnected}\n` +
        `模块注册: ${info.moduleRegistered}\n` +
        `总通知数: ${info.totalNotifications}\n` +
        `微信/支付宝通知: ${info.watchedNotifications}\n` +
        `最后包名: ${info.lastPkg}\n` +
        `最后标题: ${info.lastTitle}\n` +
        `最后文本: ${info.lastText}`,
    );
  };

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
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* 状态卡片 */}
        <Card style={styles.statusCard}>
          {permissionGranted ? (
            <View style={styles.statusContent}>
              <View style={styles.statusDot} />
              <View style={styles.statusTextGroup}>
                <AppText size="xl" weight="semibold" color={colors.sage}>
                  运行中
                </AppText>
                <AppText size="base" color={colors.textLight}>
                  正在监听微信支付和支付宝的支付通知
                </AppText>
                {pendingCount > 0 && (
                  <AppText size="base" weight="medium" color={colors.coral}>
                    {pendingCount} 条待确认记录
                  </AppText>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.statusContent}>
              <AppText size="3xl">🔔</AppText>
              <View style={styles.statusTextGroup}>
                <AppText size="xl" weight="semibold" color={colors.text}>
                  未开启
                </AppText>
                <AppText size="base" color={colors.textLight}>
                  开启通知监听权限后，每次微信/支付宝付款都会自动检测
                </AppText>
              </View>
            </View>
          )}
        </Card>

        {/* 开启权限按钮 */}
        {!permissionGranted && (
          <TouchableOpacity
            style={styles.enableBtn}
            activeOpacity={0.8}
            onPress={handleOpenSettings}
          >
            <AppText size="xl" weight="semibold" color={colors.white}>
              开启通知监听权限
            </AppText>
          </TouchableOpacity>
        )}

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

        {/* 设置引导 */}
        <View style={styles.section}>
          <AppText
            size="lg"
            weight="semibold"
            color={colors.text}
            style={styles.sectionTitle}
          >
            {permissionGranted ? "保持后台运行" : "设置步骤"}
          </AppText>
          {guideSteps.map((step, index) => (
            <Card key={step.title} style={styles.stepCard}>
              <View style={styles.stepRow}>
                <View style={styles.stepNumber}>
                  <AppText size="base" weight="bold" color={colors.white}>
                    {index + 1}
                  </AppText>
                </View>
                <View style={styles.stepText}>
                  <AppText size="lg" weight="medium" color={colors.text}>
                    {step.title}
                  </AppText>
                  <AppText size="base" color={colors.textLight}>
                    {step.description}
                  </AppText>
                </View>
              </View>
            </Card>
          ))}
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
                打开 App 时弹出确认卡片，一键记账
              </AppText>
            </View>
          </Card>
        </View>

        {/* 调试按钮（开发阶段） */}
        <TouchableOpacity
          style={styles.debugBtn}
          activeOpacity={0.8}
          onPress={handleDebug}
        >
          <AppText size="base" color={colors.textLight}>
            🔧 查看 NLS 调试信息
          </AppText>
        </TouchableOpacity>
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
  statusCard: { marginBottom: 16 },
  statusContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.sage,
  },
  statusTextGroup: { flex: 1, gap: 4 },
  enableBtn: {
    backgroundColor: colors.sage,
    borderRadius: radii.lg,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 24,
  },
  section: { marginBottom: 20 },
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
  stepCard: { marginBottom: 8 },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.sage,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  stepText: { flex: 1, gap: 2 },
  howCard: { gap: 12 },
  howRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  howText: { flex: 1 },
  debugBtn: {
    alignItems: "center",
    paddingVertical: 16,
    marginTop: 12,
    marginBottom: 20,
  },
});
