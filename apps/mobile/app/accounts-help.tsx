// 账户功能说明页面
import { View, ScrollView, StyleSheet } from "react-native";
import { TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../components/ui/AppText";
import { Card } from "../components/ui/Card";
import { colors, radii, spacing } from "../constants/theme";

export default function AccountsHelpScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <AppText size="2xl">←</AppText>
        </TouchableOpacity>
        <AppText size="2xl" weight="semibold">关于账户</AppText>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* 概述 */}
        <AppText size="2xl" weight="bold" style={styles.title}>
          "我的账户"是用来追踪你的钱放在哪里的
        </AppText>

        <AppText size="xl" color={colors.textLight} style={styles.paragraph}>
          举个例子，你有这些地方存着钱：
        </AppText>

        {/* 示例卡片 */}
        <Card style={styles.exampleCard}>
          <View style={styles.exampleRow}>
            <AppText size="xl">💚 微信钱包</AppText>
            <AppText size="xl" weight="semibold">¥ 2,300</AppText>
          </View>
          <View style={styles.exampleRow}>
            <AppText size="xl">💙 支付宝</AppText>
            <AppText size="xl" weight="semibold">¥ 1,500</AppText>
          </View>
          <View style={styles.exampleRow}>
            <AppText size="xl">🏦 招商银行卡</AppText>
            <AppText size="xl" weight="semibold">¥ 8,200</AppText>
          </View>
          <View style={styles.exampleRow}>
            <AppText size="xl">💰 现金</AppText>
            <AppText size="xl" weight="semibold">¥ 580</AppText>
          </View>
          <View style={styles.divider} />
          <View style={styles.exampleRow}>
            <AppText size="xl" weight="bold">总资产</AppText>
            <AppText size="xl" weight="bold" color={colors.sage}>¥ 12,580</AppText>
          </View>
        </Card>

        {/* 核心功能 */}
        <AppText size="2xl" weight="bold" style={styles.sectionTitle}>核心功能</AppText>

        <View style={styles.featureItem}>
          <AppText size="3xl" style={styles.featureIcon}>1️⃣</AppText>
          <View style={{ flex: 1 }}>
            <AppText size="xl" weight="semibold">创建账户</AppText>
            <AppText size="lg" color={colors.textLight} style={{ marginTop: 2 }}>
              把日常用的"钱包"都建进来（微信、支付宝、银行卡、现金等），设一个初始余额
            </AppText>
          </View>
        </View>

        <View style={styles.featureItem}>
          <AppText size="3xl" style={styles.featureIcon}>2️⃣</AppText>
          <View style={{ flex: 1 }}>
            <AppText size="xl" weight="semibold">记账时关联账户</AppText>
            <AppText size="lg" color={colors.textLight} style={{ marginTop: 2 }}>
              记一笔"午饭 30 元"时，可以选"从微信付的"。这笔支出会自动从微信的余额里扣掉
            </AppText>
          </View>
        </View>

        <View style={styles.featureItem}>
          <AppText size="3xl" style={styles.featureIcon}>3️⃣</AppText>
          <View style={{ flex: 1 }}>
            <AppText size="xl" weight="semibold">余额自动计算</AppText>
            <AppText size="lg" color={colors.textLight} style={{ marginTop: 2 }}>
              当前余额 = 初始余额 + 收入 - 支出，你不需要手动改余额
            </AppText>
          </View>
        </View>

        <View style={styles.featureItem}>
          <AppText size="3xl" style={styles.featureIcon}>4️⃣</AppText>
          <View style={{ flex: 1 }}>
            <AppText size="xl" weight="semibold">总资产一目了然</AppText>
            <AppText size="lg" color={colors.textLight} style={{ marginTop: 2 }}>
              所有账户余额加起来就是你的总资产
            </AppText>
          </View>
        </View>

        {/* 和分类的区别 */}
        <AppText size="2xl" weight="bold" style={styles.sectionTitle}>和"分类"的区别</AppText>

        <Card style={styles.compareCard}>
          <View style={styles.compareRow}>
            <AppText size="xl" weight="semibold" color={colors.coral}>分类</AppText>
            <AppText size="lg" color={colors.textLight} style={{ flex: 1, marginLeft: 12 }}>
              钱花在哪件事上了？（餐饮、交通、购物）
            </AppText>
          </View>
          <View style={styles.divider} />
          <View style={styles.compareRow}>
            <AppText size="xl" weight="semibold" color={colors.sage}>账户</AppText>
            <AppText size="lg" color={colors.textLight} style={{ flex: 1, marginLeft: 12 }}>
              钱从哪个口袋出/入的？（微信、银行卡、现金）
            </AppText>
          </View>
        </Card>

        <Card style={styles.tipCard}>
          <AppText size="lg" color={colors.text}>
            💡 同一笔交易可以同时有分类和账户：
          </AppText>
          <AppText size="lg" weight="semibold" color={colors.sage} style={{ marginTop: 6 }}>
            午饭 30 元 → 分类：餐饮 → 账户：微信
          </AppText>
          <AppText size="lg" color={colors.textLight} style={{ marginTop: 8 }}>
            记账时账户是可选的，不选就只按分类记录，和以前一样。
          </AppText>
        </Card>
      </ScrollView>
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
  content: {
    padding: spacing.xxl, paddingBottom: 40,
  },
  title: {
    marginBottom: spacing.lg,
  },
  paragraph: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    marginTop: spacing.xxl, marginBottom: spacing.lg,
  },
  exampleCard: {
    marginBottom: spacing.sm,
  },
  exampleRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 8,
  },
  divider: {
    height: 1, backgroundColor: colors.creamDark, marginVertical: 8,
  },
  featureItem: {
    flexDirection: "row", gap: 12, marginBottom: spacing.xl,
  },
  featureIcon: {
    width: 32,
  },
  compareCard: {
    marginBottom: spacing.lg,
  },
  compareRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 10,
  },
  tipCard: {
    backgroundColor: colors.sagePale, borderRadius: radii.md,
  },
});
