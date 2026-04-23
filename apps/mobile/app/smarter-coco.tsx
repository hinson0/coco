import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GuideImage } from "../components/auto/GuideImage";
import { SetupStep } from "../components/auto/SetupStep";
import { AppText } from "../components/ui/AppText";
import { colors, radii, spacing } from "../constants/theme";
import { useAutoBookkeepingStatus } from "../hooks/useAutoBookkeepingStatus";
import { AutoBookkeeping } from "../lib/auto-bookkeeping";

const guideNotifMain = require("../assets/guides/notif-main.png");
const guideNotifChannel1 = require("../assets/guides/notif-channel-1.png");
const guideNotifChannel2 = require("../assets/guides/notif-channel-2.png");
const guideNotifChannel3 = require("../assets/guides/notif-channel-3.png");
const guideAutoStart = require("../assets/guides/app-autostart.png");
const guideBattery = require("../assets/guides/battery-unlimited.png");

function Header() {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.backBtn}
        activeOpacity={0.7}
      >
        <AppText size="2xl">←</AppText>
      </TouchableOpacity>
      <AppText size="2xl" weight="semibold">
        更聪明的 CoCo
      </AppText>
      <View style={{ width: 36 }} />
    </View>
  );
}

export default function SmarterCocoScreen() {
  const insets = useSafeAreaInsets();
  const { listenerGranted, notifEnabled, channelEnabled } =
    useAutoBookkeepingStatus();

  if (Platform.OS !== "android") {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <StatusBar style="dark" backgroundColor={colors.cream} />
        <Header />
        <View style={styles.centerContent}>
          <AppText size="3xl">📱</AppText>
          <AppText
            size="2xl"
            color={colors.textLight}
            style={styles.centerText}
          >
            进阶能力仅支持 Android 设备
          </AppText>
        </View>
      </View>
    );
  }

  const notifAllDone = notifEnabled && channelEnabled;
  const allDone = listenerGranted && notifAllDone;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="dark" backgroundColor={colors.cream} />
      <Header />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <AppText size="md" color={colors.textLight} style={styles.subtitle}>
          开启进阶能力，让自动记账更稳定
        </AppText>

        <SetupStep
          step={1}
          title="通知权限"
          done={notifAllDone}
          buttonLabel="去设置"
          onPress={() => AutoBookkeeping?.openNotificationSettings()}
        >
          <AppText size="md" color={colors.textLight} style={styles.stepDesc}>
            开启「允许通知」和「悬浮通知」
          </AppText>
          <GuideImage
            source={guideNotifMain}
            label="参考：通知主设置（小米手机）"
          />
          <AppText size="md" color={colors.textLight} style={styles.stepDesc}>
            进入底部「自动记账」通知类别
          </AppText>
          <GuideImage
            source={guideNotifChannel1}
            label="参考：找到自动记账通道（小米手机）"
          />
          <AppText size="md" color={colors.textLight} style={styles.stepDesc}>
            开启「允许通知」和「悬浮通知」
          </AppText>
          <GuideImage
            source={guideNotifChannel2}
            label="参考：自动记账通知设置（小米手机）"
          />
          <AppText size="md" color={colors.textLight} style={styles.stepDesc}>
            锁屏显示选择「显示通知及其内容」
          </AppText>
          <GuideImage
            source={guideNotifChannel3}
            label="参考：锁屏通知显示规则（小米手机）"
          />
        </SetupStep>

        {/* 自启动状态无法编程查询，用其他权限完成度作为代理信号 */}
        <SetupStep
          step={2}
          title="后台运行"
          done={allDone}
          buttonLabel="去设置"
          onPress={() => AutoBookkeeping?.openAutoStartSettings()}
        >
          <AppText size="md" color={colors.textLight} style={styles.stepDesc}>
            开启自启动，确保 CoCo 在后台持续运行
          </AppText>
          <GuideImage
            source={guideAutoStart}
            label="参考：开启自启动（小米手机）"
          />
          <AppText size="md" color={colors.textLight} style={styles.stepDesc}>
            电量策略选择「无限制」，防止系统杀后台
          </AppText>
          <GuideImage
            source={guideBattery}
            label="参考：电量策略选「无限制」（小米手机）"
          />
        </SetupStep>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.creamDark,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  subtitle: {
    marginBottom: 16,
    lineHeight: 20,
  },
  stepDesc: {
    marginTop: 10,
    lineHeight: 20,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  centerText: { textAlign: "center" },
});
