// apps/mobile/app/accounts.tsx
// 账户列表页面：总资产卡片 + 账户列表 + 余额显示
import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Image,
  type ImageSourcePropType,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  useAccounts,
  useTotalAssets,
  useDeleteAccount,
} from "../hooks/useLocalAccounts";
import { useOfflineContext } from "../lib/offline-context";
import { useQuery } from "@tanstack/react-query";
import { AppText } from "../components/ui/AppText";
import { useCheckAndConsume } from "../hooks/useEntitlement";
import { EntitlementGate } from "../components/shared/EntitlementGate";
import { colors, radii, spacing, shadows } from "../constants/theme";
import type { Account } from "@coco/shared";
import type * as SQLite from "expo-sqlite";

const BRAND_ICON_MAP: Record<string, ImageSourcePropType> = {
  wechat: require("../assets/images/wechat.png"),
  alipay: require("../assets/images/alipay.png"),
};

function useAccountBalanceInline(
  db: SQLite.SQLiteDatabase | null,
  accountId: string,
) {
  return useQuery({
    queryKey: ["account-balance", accountId],
    queryFn: async (): Promise<number> => {
      if (!db) return 0;
      const account = await db.getFirstAsync<Account>(
        "SELECT * FROM accounts WHERE id = ?",
        accountId,
      );
      if (!account) return 0;
      const income = await db.getFirstAsync<{ total: number }>(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE account_id = ? AND type = 'income' AND deleted_at IS NULL",
        accountId,
      );
      const expense = await db.getFirstAsync<{ total: number }>(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE account_id = ? AND type = 'expense' AND deleted_at IS NULL",
        accountId,
      );
      return (
        account.initial_balance + (income?.total ?? 0) - (expense?.total ?? 0)
      );
    },
    enabled: !!db,
  });
}

function AccountRow({
  account,
  onLongPress,
}: {
  readonly account: Account;
  readonly onLongPress?: () => void;
}) {
  const { db } = useOfflineContext();
  const { data: balance = 0 } = useAccountBalanceInline(db, account.id);

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() =>
        router.push({
          pathname: "/account-edit",
          params: {
            id: account.id,
            name: account.name,
            icon: account.icon,
            type: account.type,
            initialBalance: String(account.initial_balance),
          },
        })
      }
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <View style={styles.rowIcon}>
        {BRAND_ICON_MAP[account.icon] ? (
          <Image
            source={BRAND_ICON_MAP[account.icon]}
            style={{ width: 24, height: 24 }}
            resizeMode="contain"
          />
        ) : (
          <AppText style={{ fontSize: 24 }}>{account.icon}</AppText>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <AppText size="xl" weight="medium">
          {account.name}
        </AppText>
      </View>
      <AppText size="xl" weight="semibold">
        ¥{" "}
        {balance.toLocaleString("zh-CN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </AppText>
      <AppText size="xl" color={colors.textLighter} style={{ marginLeft: 8 }}>
        ›
      </AppText>
    </TouchableOpacity>
  );
}

export default function AccountsScreen() {
  const insets = useSafeAreaInsets();
  const { data: accounts = [] } = useAccounts();
  const { data: totalAssets = 0 } = useTotalAssets();
  const { mutateAsync: deleteAccount } = useDeleteAccount();
  const checkAndConsume = useCheckAndConsume();
  const [showGate, setShowGate] = useState(false);

  const handleAddAccount = async () => {
    const ok = await checkAndConsume("multi_account");
    if (!ok) {
      setShowGate(true);
      return;
    }
    router.push("/account-edit");
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      "删除账户",
      `确定要删除"${name}"吗？已有的交易记录不会受影响。`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "删除",
          style: "destructive",
          onPress: () => deleteAccount(id),
        },
      ],
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconBtn}
          activeOpacity={0.75}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <AppText size="2xl" weight="semibold">
          我的账户
        </AppText>
        <TouchableOpacity
          onPress={() => router.push("/accounts-help")}
          style={styles.helpBtn}
          activeOpacity={0.7}
        >
          <AppText size="xl">❓</AppText>
        </TouchableOpacity>
      </View>

      <FlatList
        data={accounts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <LinearGradient
            colors={[colors.sage, "#6b9a7a"]}
            style={styles.totalCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <AppText size="md" color="rgba(255,255,255,0.85)">
              总资产
            </AppText>
            <AppText
              size="6xl"
              weight="bold"
              color={colors.white}
              style={{ marginTop: 4 }}
            >
              ¥{" "}
              {totalAssets.toLocaleString("zh-CN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </AppText>
          </LinearGradient>
        }
        renderItem={({ item }) => (
          <AccountRow
            account={item}
            onLongPress={() => handleDelete(item.id, item.name)}
          />
        )}
        ListFooterComponent={
          <TouchableOpacity
            style={styles.addBtn}
            onPress={handleAddAccount}
            activeOpacity={0.8}
          >
            <AppText size="2xl" weight="semibold" color={colors.white}>
              + 添加账户
            </AppText>
          </TouchableOpacity>
        }
      />
      <EntitlementGate
        visible={showGate}
        onClose={() => setShowGate(false)}
        featureLabel="多账户管理"
      />
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
    backgroundColor: colors.cream,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    ...shadows.md,
  },
  backArrow: { fontSize: 18, color: colors.text, lineHeight: 22 },
  helpBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: { padding: spacing.xl, paddingBottom: 40 },
  totalCard: {
    borderRadius: radii.lg,
    padding: spacing.xxl,
    marginBottom: spacing.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.xl,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtn: {
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.sage,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
    ...shadows.md,
  },
});
