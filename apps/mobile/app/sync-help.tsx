// 多设备同步说明页：帮助用户理解功能 + 手动触发 Pull
import { useState } from "react";
import { View, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../components/ui/AppText";
import { Card } from "../components/ui/Card";
import { colors, radii, spacing } from "../constants/theme";
import { useOfflineContext } from "@/lib/offline-context";
import { pull } from "@/lib/sync/sync-service";

export default function SyncHelpScreen() {
  const insets = useSafeAreaInsets();
  const { db, userId } = useOfflineContext();
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSync = async () => {
    if (!db || !userId || syncing) return;
    setSyncing(true);
    setError(null);
    setSuccess(false);
    try {
      await pull(db, userId);
      setSuccess(true);
    } catch (e) {
      setError("同步失败，请检查网络后重试");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <AppText size="2xl">←</AppText>
        </TouchableOpacity>
        <AppText size="2xl" weight="semibold">多设备同步</AppText>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* 概述 */}
        <AppText size="2xl" weight="bold" style={styles.title}>
          换了手机？把数据迁移过来
        </AppText>
        <AppText size="xl" color={colors.textLight} style={styles.paragraph}>
          CoCo 会自动把你的账单数据备份到云端。换手机或重装 App 后，点下面的按钮就能把数据同步回来。
        </AppText>

        {/* 自动备份说明 */}
        <AppText size="2xl" weight="bold" style={styles.sectionTitle}>自动备份</AppText>
        <Card style={styles.featureCard}>
          <View style={styles.featureItem}>
            <AppText size="3xl" style={styles.featureIcon}>☁️</AppText>
            <View style={{ flex: 1 }}>
              <AppText size="xl" weight="semibold">每 30 秒自动备份</AppText>
              <AppText size="lg" color={colors.textLight} style={{ marginTop: 2 }}>
                打开 App 后，你的账单数据会每隔 30 秒静默上传到云端，完全不影响操作
              </AppText>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.featureItem}>
            <AppText size="3xl" style={styles.featureIcon}>🔒</AppText>
            <View style={{ flex: 1 }}>
              <AppText size="xl" weight="semibold">数据仅属于你</AppText>
              <AppText size="lg" color={colors.textLight} style={{ marginTop: 2 }}>
                云端数据与你的账号绑定，只有登录后才能访问
              </AppText>
            </View>
          </View>
        </Card>

        {/* 什么时候需要手动同步 */}
        <AppText size="2xl" weight="bold" style={styles.sectionTitle}>什么时候需要手动同步？</AppText>
        <Card style={styles.scenarioCard}>
          <View style={styles.scenarioRow}>
            <AppText size="2xl">📱</AppText>
            <AppText size="lg" color={colors.text} style={{ flex: 1, marginLeft: 12 }}>
              换了新手机，登录后看不到之前的账单
            </AppText>
          </View>
          <View style={styles.divider} />
          <View style={styles.scenarioRow}>
            <AppText size="2xl">🔄</AppText>
            <AppText size="lg" color={colors.text} style={{ flex: 1, marginLeft: 12 }}>
              重新安装了 App，数据丢失
            </AppText>
          </View>
          <View style={styles.divider} />
          <View style={styles.scenarioRow}>
            <AppText size="2xl">💻</AppText>
            <AppText size="lg" color={colors.text} style={{ flex: 1, marginLeft: 12 }}>
              在另一台设备上记账后，想同步到本机
            </AppText>
          </View>
        </Card>

        {/* 提示 */}
        <Card style={styles.tipCard}>
          <AppText size="lg" color={colors.text}>
            💡 同步时，云端和本地的数据会做智能合并——谁最近修改的，就保留谁的版本。
          </AppText>
        </Card>
      </ScrollView>

      {/* 底部按钮 */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        {error && (
          <AppText size="base" color={colors.coral} style={styles.errorText}>
            {error}
          </AppText>
        )}
        {success && (
          <AppText size="base" color={colors.sage} style={styles.errorText}>
            同步完成 ✓
          </AppText>
        )}
        <TouchableOpacity
          style={[styles.syncButton, (!userId || syncing) && styles.syncButtonDisabled]}
          onPress={handleSync}
          disabled={!userId || syncing}
          activeOpacity={0.8}
        >
          {syncing ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <AppText size="xl" weight="semibold" color={!userId ? colors.textLight : colors.white}>
              {!userId ? "请先登录后再同步" : "立即同步"}
            </AppText>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.creamDark,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: radii.sm,
    backgroundColor: colors.cream, alignItems: "center", justifyContent: "center",
  },
  content: { padding: spacing.xxl, paddingBottom: 120 },
  title: { marginBottom: spacing.lg },
  paragraph: { marginBottom: spacing.xl },
  sectionTitle: { marginTop: spacing.xl, marginBottom: spacing.lg },
  featureCard: { marginBottom: spacing.lg },
  featureItem: { flexDirection: "row", gap: 12, paddingVertical: spacing.sm },
  featureIcon: { width: 36 },
  scenarioCard: { marginBottom: spacing.lg },
  scenarioRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm },
  divider: { height: 1, backgroundColor: colors.creamDark, marginVertical: 4 },
  tipCard: { backgroundColor: colors.sagePale, borderRadius: radii.md },
  footer: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: colors.white, paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    borderTopWidth: 1, borderTopColor: colors.creamDark,
  },
  errorText: { textAlign: "center", marginBottom: spacing.sm },
  syncButton: {
    backgroundColor: colors.sage, borderRadius: radii.lg,
    paddingVertical: spacing.lg, alignItems: "center",
  },
  syncButtonDisabled: { backgroundColor: colors.creamDark },
});
