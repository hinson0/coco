// apps/mobile/app/upgrade-pro.tsx
// 升级 Pro 页面：展示免费/广告/付费会员权益
import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText } from '../components/ui/AppText';
import { Card } from '../components/ui/Card';
import { colors, radii, shadows, spacing } from '../constants/theme';

export default function UpgradeProScreen() {
  const insets = useSafeAreaInsets();
  const [plan, setPlan] = useState<'monthly' | 'yearly'>('yearly');

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <AppText size="2xl">←</AppText>
        </TouchableOpacity>
        <AppText size="2xl" weight="semibold">升级 Pro</AppText>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Sage 渐变 Banner */}
        <LinearGradient
          colors={['#5a9468', '#7ba68a']}
          style={styles.banner}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <AppText style={{ fontSize: 40, marginBottom: 8 }}>🍃</AppText>
          <AppText size="4xl" weight="bold" color={colors.white}>棉花记 Pro</AppText>
          <AppText size="md" color="rgba(255,255,255,0.7)" style={{ marginTop: 4 }}>
            解锁全部记账能力
          </AppText>
        </LinearGradient>

        {/* 免费功能区 */}
        <View style={styles.section}>
          <AppText size="xl" weight="semibold" color={colors.text} style={styles.sectionTitle}>
            ✅ 免费功能（永久）
          </AppText>
          <Card padding={0}>
            <View style={styles.freeRow}>
              <AppText size="md" color={colors.text} weight="medium">📝 手动记账</AppText>
              <AppText size="sm" color={colors.textLight}>快速输入金额、选择分类，秒级完成记账</AppText>
            </View>
            <View style={styles.divider} />
            <View style={styles.freeRow}>
              <AppText size="md" color={colors.text} weight="medium">🤖 文字 AI 记账</AppText>
              <AppText size="sm" color={colors.textLight}>输入"咖啡40块"自动识别金额和分类，内置离线规则引擎覆盖 200+ 关键词</AppText>
            </View>
            <View style={styles.divider} />
            <View style={styles.freeRow}>
              <AppText size="md" color={colors.text} weight="medium">📊 收支统计与图表</AppText>
              <AppText size="sm" color={colors.textLight}>月度收支汇总、日趋势折线图、分类排行饼图、单笔排行榜</AppText>
            </View>
            <View style={styles.divider} />
            <View style={styles.freeRow}>
              <AppText size="md" color={colors.text} weight="medium">🎯 预算管理</AppText>
              <AppText size="sm" color={colors.textLight}>设置月度总预算和分类预算，实时查看消费进度</AppText>
            </View>
            <View style={styles.divider} />
            <View style={styles.freeRow}>
              <AppText size="md" color={colors.text} weight="medium">🔔 记账提醒</AppText>
              <AppText size="sm" color={colors.textLight}>每日定时通知提醒，帮你养成记账好习惯</AppText>
            </View>
          </Card>
        </View>

        {/* Pro 会员区 */}
        <View style={styles.section}>
          <AppText size="xl" weight="semibold" color={colors.text} style={styles.sectionTitle}>
            👑 Pro 会员
          </AppText>
          <Card padding={0}>
            <View style={styles.proRow}>
              <AppText size="md" color={colors.text} weight="medium">🚀 全功能无限使用</AppText>
              <AppText size="sm" color={colors.textLight}>语音记账、小票识别、多账户管理，无次数限制</AppText>
            </View>
            <View style={styles.divider} />
            <View style={styles.proRow}>
              <AppText size="md" color={colors.text} weight="medium">🚫 去除所有广告</AppText>
              <AppText size="sm" color={colors.textLight}>纯净记账体验，不再被广告打断</AppText>
            </View>
            <View style={styles.divider} />
            <View style={styles.proRow}>
              <AppText size="md" color={colors.text} weight="medium">📤 报表导出</AppText>
              <AppText size="sm" color={colors.textLight}>一键导出全部记录为 CSV，支持 Excel / WPS / Numbers</AppText>
            </View>
            <View style={styles.divider} />
            <View style={styles.proRow}>
              <AppText size="md" color={colors.text} weight="medium">✨ 优先体验新功能</AppText>
              <AppText size="sm" color={colors.textLight}>新功能第一时间解锁，抢先使用</AppText>
            </View>
          </Card>
          <View style={[styles.planRow, { marginTop: 14 }]}>
            {/* 月会员卡 */}
            <TouchableOpacity
              style={[
                styles.planCard,
                {
                  borderColor: plan === 'monthly' ? colors.sage : colors.creamDark,
                  borderWidth: plan === 'monthly' ? 2 : 1,
                },
              ]}
              activeOpacity={0.7}
              onPress={() => setPlan('monthly')}
            >
              <AppText size="lg" weight="semibold" color={colors.text}>月会员</AppText>
              <View style={styles.priceRow}>
                <AppText size="3xl" weight="bold" color={colors.sage}>¥15</AppText>
                <AppText size="sm" color={colors.textLight}>/月</AppText>
              </View>
              <AppText size="xs" color={colors.textLighter}>≈ 0.5元/天</AppText>
            </TouchableOpacity>

            {/* 年会员卡 */}
            <TouchableOpacity
              style={[
                styles.planCard,
                {
                  borderColor: plan === 'yearly' ? colors.sage : colors.creamDark,
                  borderWidth: plan === 'yearly' ? 2 : 1,
                },
              ]}
              activeOpacity={0.7}
              onPress={() => setPlan('yearly')}
            >
              {/* 推荐标签 */}
              <View style={styles.recommendTag}>
                <AppText size="xs" weight="semibold" color={colors.white}>推荐</AppText>
              </View>
              <AppText size="lg" weight="semibold" color={colors.text}>年会员</AppText>
              <View style={styles.priceRow}>
                <AppText size="3xl" weight="bold" color={colors.sage}>¥138</AppText>
                <AppText size="sm" color={colors.textLight}>/年</AppText>
              </View>
              <AppText size="xs" color={colors.textLighter}>≈ 0.38元/天</AppText>
            </TouchableOpacity>
          </View>
        </View>

        {/* 底部开通按钮 */}
        <TouchableOpacity
          style={styles.ctaBtn}
          activeOpacity={0.7}
          onPress={() => Alert.alert('提示', '功能开发中，敬请期待')}
        >
          <AppText size="xl" weight="bold" color={colors.white}>立即开通</AppText>
        </TouchableOpacity>

        {/* 底部提示 */}
        <AppText size="sm" color={colors.textLighter} style={styles.footerHint}>
          🎁 新用户注册享 21 天全功能免费体验
        </AppText>
      </ScrollView>
    </View>
  );
}


const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
    backgroundColor: colors.cream, borderBottomWidth: 1, borderBottomColor: colors.creamDark,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: radii.sm,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
  },
  scrollContent: {
    padding: 20, paddingBottom: 40,
  },
  banner: {
    borderRadius: 18, padding: 24, alignItems: 'center',
    marginBottom: 8,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    marginBottom: 10,
  },
  divider: {
    height: 1, backgroundColor: colors.creamDark, marginHorizontal: 18,
  },
  freeRow: {
    paddingHorizontal: 18, paddingVertical: 12, gap: 4,
  },
  proRow: {
    paddingHorizontal: 18, paddingVertical: 12, gap: 4,
  },
  priceRow: {
    flexDirection: 'row', alignItems: 'baseline', gap: 2, marginTop: 8,
  },
  planRow: {
    flexDirection: 'row', gap: 12,
  },
  planCard: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.white, borderRadius: radii.lg,
    paddingVertical: 20, paddingHorizontal: 12,
    position: 'relative', overflow: 'hidden',
    ...shadows.sm,
  },
  recommendTag: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: colors.coral, paddingHorizontal: 8, paddingVertical: 3,
    borderBottomLeftRadius: radii.sm,
  },
  ctaBtn: {
    marginTop: 28, height: 52, borderRadius: radii.md,
    backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center',
    ...shadows.md,
  },
  footerHint: {
    textAlign: 'center', marginTop: 16,
  },
});
