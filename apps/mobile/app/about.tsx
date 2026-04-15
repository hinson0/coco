import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  Linking,
} from "react-native";
import { TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { AppText } from "../components/ui/AppText";
import { Card } from "../components/ui/Card";
import { MenuItem } from "../components/shared/MenuItem";
import { colors, radii, shadows } from "../constants/theme";

const version = Constants.expoConfig?.version ?? "1.0.0";

const features = [
  {
    emoji: "🤖",
    label: "AI 智能记账",
    desc: '对话式记账，输入"咖啡40块"即可自动识别金额、分类和备注。内置离线规则引擎，覆盖餐饮、交通、购物等 8 大类 200+ 关键词，无网络也能秒速记账。复杂语句自动调用在线 AI 识别。',
  },
  {
    emoji: "🎤",
    label: "语音记账",
    desc: "长按说话，松开即识别。支持最长 60 秒语音输入，自动转文字后走智能识别流程。上滑可取消录音，操作直觉无门槛。",
  },
  {
    emoji: "📸",
    label: "小票识别",
    desc: "拍摄小票或选择相册照片，自动 OCR 识别金额和商家信息并生成记账记录。识别结果以小票缩略图展示，方便核对。",
  },
  {
    emoji: "📊",
    label: "预算管理与统计",
    desc: "支持设置月度总预算和分类预算，实时显示消费进度。统计页提供收支汇总、日趋势折线图、分类排行饼图、单笔排行榜和 AI 趋势洞察，支持按月切换查看。",
  },
  {
    emoji: "💰",
    label: "多账户管理",
    desc: "支持储蓄卡、信用卡、微信、支付宝、现金及自定义账户。每个账户独立追踪余额（初始余额 + 收入 - 支出），底部汇总显示总资产。记账时可指定资金账户。",
  },
  {
    emoji: "📤",
    label: "报表导出",
    desc: "一键导出全部记账记录为 CSV 文件，包含日期、时间、分类、金额、备注、来源、账户等 12 个字段。UTF-8 编码兼容 Excel、WPS、Numbers，通过系统分享发送。",
  },
];

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
          关于CoCo
        </AppText>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo 区 */}
        <View style={styles.logoSection}>
          <AppText style={{ fontSize: 61 }}>🍃</AppText>
          <AppText size="4xl" weight="bold" color={colors.text}>
            CoCo
          </AppText>
          <AppText size="base" color={colors.textLighter}>
            v{version}
          </AppText>
        </View>

        {/* 功能亮点区 */}
        <View style={styles.section}>
          <AppText
            size="base"
            weight="medium"
            color={colors.textLighter}
            style={styles.sectionTitle}
          >
            功能亮点
          </AppText>
          <Card padding={0}>
            {features.map((item, index) => {
              const isExpanded = expandedIndex === index;
              return (
                <View key={item.label}>
                  <TouchableOpacity
                    style={styles.featureRow}
                    activeOpacity={0.6}
                    onPress={() => setExpandedIndex(isExpanded ? null : index)}
                  >
                    <AppText size="2xl">{item.emoji}</AppText>
                    <AppText
                      size="xl"
                      weight="medium"
                      color={colors.text}
                      style={styles.featureLabel}
                    >
                      {item.label}
                    </AppText>
                    <AppText size="xl" color={colors.textLighter}>
                      {isExpanded ? "∧" : "∨"}
                    </AppText>
                  </TouchableOpacity>
                  {isExpanded && (
                    <View style={styles.featureDesc}>
                      <AppText
                        size="base"
                        color={colors.textLight}
                        style={styles.featureDescText}
                      >
                        {item.desc}
                      </AppText>
                    </View>
                  )}
                  {index < features.length - 1 && (
                    <View style={styles.divider} />
                  )}
                </View>
              );
            })}
          </Card>
        </View>

        {/* 更多操作区 */}
        <View style={styles.section}>
          <Card padding={0}>
            <MenuItem
              icon="🔄"
              iconBg={colors.sagePale}
              title="检查更新"
              onPress={() => Alert.alert("提示", "已是最新版本")}
            />
            <View style={styles.divider} />
            <MenuItem
              icon="📋"
              iconBg={colors.honeyPale}
              title="用户协议"
              onPress={() => Linking.openURL("https://example.com/terms")}
            />
            <View style={styles.divider} />
            <MenuItem
              icon="🔒"
              iconBg={colors.lavenderPale}
              title="隐私政策"
              onPress={() => Linking.openURL("https://example.com/privacy")}
            />
          </Card>
        </View>

        {/* 底部版权信息 */}
        <View style={styles.footer}>
          <AppText size="sm" color={colors.textLighter}>
            联系我们: feedback@example.com
          </AppText>
          <AppText
            size="sm"
            color={colors.textLighter}
            style={{ marginTop: 4 }}
          >
            © 2025 CoCo
          </AppText>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
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
  backArrow: { fontSize: 19, color: colors.text, lineHeight: 23 },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  logoSection: {
    alignItems: "center",
    paddingTop: 40,
    paddingBottom: 30,
    gap: 6,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    marginBottom: 10,
    marginLeft: 4,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 12,
  },
  featureLabel: {
    flex: 1,
  },
  featureDesc: {
    backgroundColor: colors.cream,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 8,
  },
  featureDescText: {
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: colors.creamDark,
    marginHorizontal: 18,
  },
  footer: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 8,
  },
});
