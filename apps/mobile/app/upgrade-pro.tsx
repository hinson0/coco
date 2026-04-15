// apps/mobile/app/upgrade-pro.tsx
// 升级 Pro 页面：Premium Botanical 设计风格
import { useState } from "react";
import {
  ActivityIndicator,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radii, shadows } from "../constants/theme";
import { useIAP } from "../hooks/useIAP";
import type { PlanType } from "../lib/iap/products";

const PRO_FEATURES = [
  {
    icon: "🚀",
    title: "全功能无限使用",
    desc: "语音记账、小票识别、多账户管理，无次数限制",
  },
  { icon: "🚫", title: "去除所有广告", desc: "纯净记账体验，不再被广告打断" },
  {
    icon: "📤",
    title: "报表导出",
    desc: "一键导出全部记录为 CSV，支持 Excel / WPS / Numbers",
  },
  { icon: "✨", title: "优先体验新功能", desc: "新功能第一时间解锁，抢先使用" },
];

const FREE_FEATURES = [
  {
    icon: "📝",
    title: "手动记账",
    desc: "快速输入金额、选择分类，秒级完成记账",
  },
  {
    icon: "🤖",
    title: "文字 AI 记账",
    desc: '输入"咖啡40块"自动识别，内置 200+ 关键词',
  },
  { icon: "📊", title: "收支统计", desc: "月度汇总、日趋势折线图、分类排行" },
  { icon: "🎯", title: "预算管理", desc: "设置月度总预算和分类预算，实时进度" },
  { icon: "🔔", title: "记账提醒", desc: "每日定时通知，帮你养成记账好习惯" },
];

export default function UpgradeProScreen() {
  const insets = useSafeAreaInsets();
  const [plan, setPlan] = useState<PlanType>("yearly");
  const { purchase, restore, purchaseState, isAvailable } = useIAP();
  const isBusy =
    purchaseState === "loading" ||
    purchaseState === "purchasing" ||
    purchaseState === "verifying";

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        {/* ── Hero ── */}
        <LinearGradient
          colors={["#4a7a60", "#6a9878", "#7ba68a"]}
          style={[styles.hero, { paddingTop: insets.top + 20 }]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.9, y: 1 }}
        >
          {/* 返回按钮 */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, { top: insets.top + 10 }]}
            activeOpacity={0.75}
          >
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>

          <Text style={styles.crownEmoji}>👑</Text>
          <Text style={styles.heroTitle}>棉花记 Pro</Text>
          <Text style={styles.heroSubtitle}>专业版 · 解锁全部记账能力</Text>

          <View style={styles.trialBadge}>
            <Text style={styles.trialText}>
              🎁 新用户享 21 天全功能免费体验
            </Text>
          </View>
        </LinearGradient>

        {/* ── 内容区上移覆盖 hero ── */}
        <View style={styles.contentCard}>
          {/* 选择套餐 */}
          <View style={styles.sectionRow}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>选择套餐</Text>
          </View>

          {/* 年会员卡 */}
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => setPlan("yearly")}
            style={[
              styles.planCard,
              plan === "yearly" && styles.planCardSelected,
            ]}
          >
            {plan === "yearly" && <View style={styles.planSelectedBar} />}
            <View style={styles.planTopRow}>
              <Text
                style={[
                  styles.planName,
                  plan === "yearly" && styles.planNameSelected,
                ]}
              >
                年会员
              </Text>
              <View style={styles.badgeGroup}>
                <View style={styles.badgeSave}>
                  <Text style={styles.badgeSaveText}>省 27%</Text>
                </View>
                <View style={styles.badgeRec}>
                  <Text style={styles.badgeRecText}>推荐</Text>
                </View>
              </View>
            </View>
            <View style={styles.priceRow}>
              <Text
                style={[
                  styles.priceCurrency,
                  plan === "yearly" && styles.priceColorActive,
                ]}
              >
                ¥
              </Text>
              <Text
                style={[
                  styles.priceNumber,
                  plan === "yearly" && styles.priceColorActive,
                ]}
              >
                88
              </Text>
              <Text style={styles.priceUnit}>/年</Text>
            </View>
            <Text style={styles.priceNote}>≈ ¥0.24 / 天 · 月均仅 ¥7.3</Text>
          </TouchableOpacity>

          {/* 月会员卡 */}
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => setPlan("monthly")}
            style={[
              styles.planCard,
              plan === "monthly" && styles.planCardSelected,
            ]}
          >
            {plan === "monthly" && <View style={styles.planSelectedBar} />}
            <View style={styles.planTopRow}>
              <Text
                style={[
                  styles.planName,
                  plan === "monthly" && styles.planNameSelected,
                ]}
              >
                月会员
              </Text>
            </View>
            <View style={styles.priceRow}>
              <Text
                style={[
                  styles.priceCurrency,
                  plan === "monthly" && styles.priceColorActive,
                ]}
              >
                ¥
              </Text>
              <Text
                style={[
                  styles.priceNumber,
                  plan === "monthly" && styles.priceColorActive,
                ]}
              >
                10
              </Text>
              <Text style={styles.priceUnit}>/月</Text>
            </View>
            <Text style={styles.priceNote}>≈ ¥0.33 / 天</Text>
          </TouchableOpacity>

          {/* 永久会员卡 */}
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => setPlan("lifetime")}
            style={[
              styles.planCard,
              plan === "lifetime" && styles.planCardSelected,
            ]}
          >
            {plan === "lifetime" && <View style={styles.planSelectedBar} />}
            <View style={styles.planTopRow}>
              <Text
                style={[
                  styles.planName,
                  plan === "lifetime" && styles.planNameSelected,
                ]}
              >
                永久会员
              </Text>
              <View style={styles.badgeGroup}>
                <View style={styles.badgeSave}>
                  <Text style={styles.badgeSaveText}>买断</Text>
                </View>
              </View>
            </View>
            <View style={styles.priceRow}>
              <Text
                style={[
                  styles.priceCurrency,
                  plan === "lifetime" && styles.priceColorActive,
                ]}
              >
                ¥
              </Text>
              <Text
                style={[
                  styles.priceNumber,
                  plan === "lifetime" && styles.priceColorActive,
                ]}
              >
                138
              </Text>
              <Text style={styles.priceUnit}> 一次性</Text>
            </View>
            <Text style={styles.priceNote}>
              一次购买，永久使用所有 Pro 功能
            </Text>
          </TouchableOpacity>

          {/* CTA 按钮 */}
          <TouchableOpacity
            activeOpacity={0.8}
            disabled={isBusy}
            onPress={() => {
              if (!isAvailable) {
                Alert.alert("提示", "当前环境不支持支付，请使用正式版本");
                return;
              }
              purchase(plan);
            }}
            style={[styles.ctaWrap, isBusy && { opacity: 0.6 }]}
          >
            <LinearGradient
              colors={["#2d5a40", "#5a9468"]}
              style={styles.ctaBtn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {isBusy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaText}>
                  {plan === "lifetime"
                    ? "一次性买断 Pro"
                    : `开通${plan === "yearly" ? "年" : "月"}会员`}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.ctaNote}>随时可取消 · 到期不自动续费</Text>

          {/* 恢复购买 */}
          <TouchableOpacity
            activeOpacity={0.7}
            disabled={isBusy}
            onPress={() => restore()}
            style={styles.restoreBtn}
          >
            <Text style={styles.restoreText}>恢复购买</Text>
          </TouchableOpacity>

          {/* Pro 专属权益 */}
          <View style={[styles.sectionRow, { marginTop: 28 }]}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>Pro 专属权益</Text>
          </View>

          <View style={styles.featureCard}>
            {PRO_FEATURES.map((f, i) => (
              <View
                key={i}
                style={[styles.featureRow, i > 0 && styles.featureDivider]}
              >
                <Text style={styles.featureIcon}>{f.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* 免费功能 */}
          <View style={[styles.sectionRow, { marginTop: 24 }]}>
            <View
              style={[
                styles.sectionAccent,
                { backgroundColor: colors.textLighter },
              ]}
            />
            <Text style={[styles.sectionTitle, { color: colors.textLight }]}>
              免费功能（永久包含）
            </Text>
          </View>

          <View style={[styles.featureCard, { opacity: 0.8 }]}>
            {FREE_FEATURES.map((f, i) => (
              <View
                key={i}
                style={[styles.featureRow, i > 0 && styles.featureDivider]}
              >
                <Text style={[styles.featureIcon, { fontSize: 20 }]}>
                  {f.icon}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.featureTitle,
                      { fontSize: 15, fontWeight: "500" },
                    ]}
                  >
                    {f.title}
                  </Text>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Hero ──────────────────────────────────────
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 60,
    alignItems: "center",
    minHeight: 260,
    position: "relative",
  },
  backBtn: {
    position: "absolute",
    left: 16,
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  backArrow: { fontSize: 18, color: "#fff", lineHeight: 22 },
  crownEmoji: { fontSize: 52, marginTop: 4 },
  heroTitle: {
    fontSize: 30,
    fontWeight: "700",
    color: "#fff",
    marginTop: 10,
    letterSpacing: 1,
  },
  heroSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    marginTop: 6,
    letterSpacing: 0.3,
  },
  trialBadge: {
    marginTop: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: radii.full,
  },
  trialText: { fontSize: 13, color: "rgba(255,255,255,0.85)" },

  // ── 内容区 ─────────────────────────────────────
  contentCard: {
    marginTop: -32,
    backgroundColor: colors.cream,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 28,
  },

  // ── Section header ─────────────────────────────
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionAccent: {
    width: 4,
    height: 20,
    borderRadius: 2,
    backgroundColor: colors.sage,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.text,
  },

  // ── 定价卡片 ───────────────────────────────────
  planCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: colors.creamDark,
    overflow: "hidden",
    position: "relative",
    ...shadows.sm,
  },
  planCardSelected: {
    borderColor: colors.sage,
    ...shadows.md,
  },
  planSelectedBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.sage,
    borderTopLeftRadius: radii.lg,
    borderBottomLeftRadius: radii.lg,
  },
  planTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  planName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textLight,
  },
  planNameSelected: {
    color: colors.text,
  },
  badgeGroup: { flexDirection: "row", gap: 6 },
  badgeSave: {
    backgroundColor: colors.honeyPale,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  badgeSaveText: { fontSize: 12, fontWeight: "600", color: colors.honey },
  badgeRec: {
    backgroundColor: colors.sagePale,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  badgeRecText: { fontSize: 12, fontWeight: "600", color: colors.sage },

  // 价格数字（核心改动：52px bold）
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
  },
  priceCurrency: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textLighter,
    marginBottom: 4,
  },
  priceNumber: {
    fontSize: 44,
    fontWeight: "800",
    color: colors.textLighter,
    lineHeight: 52,
  },
  priceUnit: {
    fontSize: 15,
    color: colors.textLighter,
    marginLeft: 4,
    marginBottom: 6,
  },
  priceColorActive: {
    color: colors.sage,
  },
  priceNote: {
    fontSize: 13,
    color: colors.textLighter,
    marginTop: 4,
  },

  // ── CTA ───────────────────────────────────────
  ctaWrap: {
    marginTop: 20,
    borderRadius: radii.md,
    overflow: "hidden",
    ...shadows.md,
  },
  ctaBtn: {
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.8,
  },
  ctaNote: {
    textAlign: "center",
    fontSize: 12,
    color: colors.textLighter,
    marginTop: 10,
  },
  restoreBtn: {
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 4,
  },
  restoreText: {
    fontSize: 14,
    color: colors.textLight,
    textDecorationLine: "underline",
  },

  // ── 权益列表 ───────────────────────────────────
  featureCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    overflow: "hidden",
    ...shadows.sm,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 14,
  },
  featureDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.creamDark,
  },
  featureIcon: { fontSize: 22, marginTop: 2 },
  featureTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 3,
  },
  featureDesc: {
    fontSize: 13,
    color: colors.textLight,
    lineHeight: 19,
  },
});
