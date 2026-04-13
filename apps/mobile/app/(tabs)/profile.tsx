import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { AiAssistantCard } from "../../components/profile/AiAssistantCard";
import { ExportSheet } from "../../components/profile/ExportSheet";
import { ProfileHeader } from "../../components/profile/ProfileHeader";
import { ReminderSheet } from "../../components/profile/ReminderSheet";
import { StatsStrip } from "../../components/profile/StatsStrip";
import { MenuItem } from "../../components/shared/MenuItem";
import { AppText } from "../../components/ui/AppText";
import { Card } from "../../components/ui/Card";
import { colors } from "../../constants/theme";
import { useAuth } from "../../hooks/useAuth";
import { useEnsureProfile, useProfile } from "../../hooks/useLocalProfile";
import { useOfflineContext } from "../../lib/offline-context";

function useProfileStats() {
  const { db, userId } = useOfflineContext();

  return useQuery({
    queryKey: ["transactions", "stats", userId],
    queryFn: async () => {
      if (!db || !userId)
        return { monthlyCount: 0, streak: 0, budgetMonths: 0 };

      const now = new Date();
      const monthStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      ).toISOString();
      const monthEnd = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        1,
      ).toISOString();

      const [monthlyRow, budgetRow, dayRows] = await Promise.all([
        db.getFirstAsync<{ count: number }>(
          "SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND deleted_at IS NULL AND occurred_at >= ? AND occurred_at < ?",
          userId,
          monthStart,
          monthEnd,
        ),
        db.getFirstAsync<{ count: number }>(
          "SELECT COUNT(DISTINCT strftime('%Y-%m', occurred_at)) as count FROM transactions WHERE user_id = ? AND deleted_at IS NULL",
          userId,
        ),
        db.getAllAsync<{ day: string }>(
          "SELECT DISTINCT date(occurred_at) as day FROM transactions WHERE user_id = ? AND deleted_at IS NULL ORDER BY day DESC",
          userId,
        ),
      ]);

      // 计算连续记账天数
      let streak = 0;
      const today = new Date();
      const daySet = new Set(dayRows.map((r) => r.day));
      for (let i = 0; i < 365; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (daySet.has(key)) {
          streak += 1;
        } else {
          break;
        }
      }

      return {
        monthlyCount: monthlyRow?.count ?? 0,
        streak,
        budgetMonths: budgetRow?.count ?? 0,
      };
    },
    enabled: !!db && !!userId,
  });
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { data: stats } = useProfileStats();
  const [exportVisible, setExportVisible] = useState(false);
  const [reminderVisible, setReminderVisible] = useState(false);
  const { monthlyCount = 0, streak = 0, budgetMonths = 0 } = stats ?? {};
  const { data: profile } = useProfile();
  const { mutate: ensureProfile } = useEnsureProfile();

  useEffect(() => {
    ensureProfile();
  }, []);

  const userName =
    profile?.nickname ?? user?.email?.split("@")[0] ?? "棉花用户";

  const handleSignOut = () => {
    Alert.alert("退出登录", "确定要退出吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "退出",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const statsItems = [
    {
      value: String(monthlyCount),
      label: "本月笔数",
      onPress: () => router.push("/category-detail"),
    },
    {
      value: String(streak),
      label: "连续记账",
      onPress: () => router.push("/streak-detail"),
    },
    {
      value: String(budgetMonths),
      label: "预算达标月",
      onPress: () => router.push("/budget-months-detail"),
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ProfileHeader
        name={userName}
        daysCount={streak}
        avatarType={profile?.avatar_type}
        avatarValue={profile?.avatar_value}
        onAvatarPress={() => router.push("/profile-edit")}
      />

      <StatsStrip items={statsItems} />

      <AiAssistantCard />

      {/* 资产管理 */}
      <AppText
        size="base"
        color={colors.textLighter}
        weight="semibold"
        style={styles.sectionTitle}
      >
        资产管理
      </AppText>
      <Card padding={0} style={styles.menuCard}>
        <MenuItem
          icon="💳"
          iconBg={colors.sagePale}
          title="我的账户"
          onPress={() => router.push("/accounts")}
        />
        <View style={styles.separator} />
        <MenuItem
          icon="🎯"
          iconBg={colors.honeyPale}
          title="预算设置"
          onPress={() => router.push("/budget-manage")}
        />
        <View style={styles.separator} />
        <MenuItem
          icon="🏷️"
          iconBg={colors.coralPale}
          title="分类管理"
          onPress={() => router.push("/category-manage")}
        />
      </Card>

      {/* 工具 */}
      <AppText
        size="base"
        color={colors.textLighter}
        weight="semibold"
        style={styles.sectionTitle}
      >
        工具
      </AppText>
      <Card padding={0} style={styles.menuCard}>
        <MenuItem
          icon="📤"
          iconBg={colors.sagePale}
          title="导出报表"
          onPress={() => setExportVisible(true)}
        />
        <View style={styles.separator} />
        <MenuItem
          icon="🔔"
          iconBg={colors.honeyPale}
          title="记账提醒"
          onPress={() => setReminderVisible(true)}
        />
        <View style={styles.separator} />
        <MenuItem
          icon="☁️"
          iconBg={colors.sagePale}
          title="多设备同步"
          onPress={() => router.push("/sync-help")}
        />
      </Card>

      {/* 其他 */}
      <AppText
        size="base"
        color={colors.textLighter}
        weight="semibold"
        style={styles.sectionTitle}
      >
        其他
      </AppText>
      <Card padding={0} style={styles.menuCard}>
        <MenuItem
          icon="🌟"
          iconBg={colors.coralPale}
          title="升级Pro"
          badge={{ text: "PRO", variant: "pro" }}
          onPress={() => router.push("/upgrade-pro")}
        />
        <View style={styles.separator} />
        <MenuItem
          icon="💬"
          iconBg={colors.creamDark}
          title="意见反馈"
          onPress={() => router.push("/feedback")}
        />
        <View style={styles.separator} />
        <MenuItem
          icon="ℹ️"
          iconBg={colors.creamDark}
          title="关于棉花记"
          onPress={() => router.push("/about")}
        />
      </Card>

      {/* 退出登录 */}
      <TouchableOpacity onPress={handleSignOut} activeOpacity={0.7}>
        <Card style={styles.logoutCard}>
          <AppText
            size="2xl"
            weight="semibold"
            color="#DC2626"
            style={styles.logoutText}
          >
            退出登录
          </AppText>
        </Card>
      </TouchableOpacity>
      <ExportSheet
        visible={exportVisible}
        onClose={() => setExportVisible(false)}
      />
      <ReminderSheet
        visible={reminderVisible}
        onClose={() => setReminderVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    paddingBottom: 40,
  },
  sectionTitle: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 6,
    marginHorizontal: 20,
  },
  menuCard: {
    marginHorizontal: 20,
    marginBottom: 4,
    overflow: "hidden",
  },
  separator: {
    height: 1,
    backgroundColor: colors.creamDark,
    marginHorizontal: 18,
  },
  logoutCard: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 8,
    alignItems: "center",
  },
  logoutText: {
    textAlign: "center",
  },
});
