import { View, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../components/ui/AppText';
import { Card } from '../components/ui/Card';
import { colors, radii, shadows } from '../constants/theme';

function AdRow({ number, text, desc }: { readonly number: number; readonly text: string; readonly desc: string }) {
  return (
    <View style={styles.adRow}>
      <View style={styles.adBadge}>
        <AppText size="sm" weight="bold" color={colors.white}>{number}</AppText>
      </View>
      <View style={styles.adRowText}>
        <AppText size="xl" weight="medium" color={colors.text}>{text}</AppText>
        <AppText size="base" color={colors.textLight}>{desc}</AppText>
      </View>
    </View>
  );
}

export default function AdRewardsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.75}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <AppText size="2xl" weight="bold" color={colors.text}>广告收益</AppText>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 说明 */}
        <View style={styles.introSection}>
          <AppText size="3xl">🎬</AppText>
          <AppText size="xl" weight="medium" color={colors.text}>
            观看广告，免费解锁高级功能
          </AppText>
          <AppText size="base" color={colors.textLight} style={styles.introDesc}>
            每天观看短视频广告即可逐步解锁付费功能，权益可累积，未使用不过期
          </AppText>
        </View>

        {/* 解锁规则 */}
        <AppText size="base" color={colors.textLighter} weight="semibold" style={styles.sectionTitle}>
          解锁规则
        </AppText>
        <Card padding={0}>
          <AdRow
            number={1}
            text="语音记账"
            desc="长按说话即可记账，支持 60 秒语音输入，自动识别金额和分类"
          />
          <View style={styles.divider} />
          <AdRow
            number={2}
            text="小票识别"
            desc="拍摄小票或选择相册照片，OCR 自动识别金额和商家信息"
          />
          <View style={styles.divider} />
          <AdRow
            number={3}
            text="多账户管理"
            desc="支持储蓄卡、信用卡、微信、支付宝等多种账户，独立追踪余额"
          />
        </Card>

        {/* 累积规则 */}
        <AppText size="base" color={colors.textLighter} weight="semibold" style={styles.sectionTitle}>
          累积规则
        </AppText>
        <Card style={styles.ruleCard}>
          <View style={styles.ruleRow}>
            <AppText size="2xl" style={styles.ruleIcon}>🔄</AppText>
            <View style={styles.ruleText}>
              <AppText size="xl" weight="medium">循环解锁</AppText>
              <AppText size="base" color={colors.textLight} style={styles.ruleDesc}>
                第 4 条广告解锁次日语音记账，第 5 条解锁次日小票识别，以此类推
              </AppText>
            </View>
          </View>
          <View style={styles.ruleSeparator} />
          <View style={styles.ruleRow}>
            <AppText size="2xl" style={styles.ruleIcon}>📦</AppText>
            <View style={styles.ruleText}>
              <AppText size="xl" weight="medium">权益囤积</AppText>
              <AppText size="base" color={colors.textLight} style={styles.ruleDesc}>
                可提前观看多条广告，囤积未来多天的功能使用权
              </AppText>
            </View>
          </View>
          <View style={styles.ruleSeparator} />
          <View style={styles.ruleRow}>
            <AppText size="2xl" style={styles.ruleIcon}>♾️</AppText>
            <View style={styles.ruleText}>
              <AppText size="xl" weight="medium">永不过期</AppText>
              <AppText size="base" color={colors.textLight} style={styles.ruleDesc}>
                已解锁的权益不会过期，用完才扣除
              </AppText>
            </View>
          </View>
        </Card>

        {/* Pro 提示 */}
        <TouchableOpacity
          style={styles.proHint}
          activeOpacity={0.7}
          onPress={() => router.push('/upgrade-pro')}
        >
          <AppText size="base" color={colors.sage} weight="medium">
            👑 升级 Pro 会员，全部功能无限使用，无需观看广告 →
          </AppText>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    ...shadows.md,
  },
  backArrow: { fontSize: 18, color: colors.text, lineHeight: 22 },
  placeholder: { width: 36 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  introSection: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  introDesc: {
    textAlign: 'center',
    paddingHorizontal: 20,
    marginTop: 4,
  },
  sectionTitle: { paddingTop: 14, paddingBottom: 6, paddingHorizontal: 4 },
  adRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  adBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  adRowText: {
    flex: 1,
    gap: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.creamDark,
    marginHorizontal: 18,
  },
  ruleCard: { gap: 0 },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 4,
  },
  ruleIcon: { width: 32, textAlign: 'center' },
  ruleText: { flex: 1, gap: 2 },
  ruleDesc: { marginTop: 2 },
  ruleSeparator: {
    height: 1,
    backgroundColor: colors.creamDark,
    marginVertical: 10,
    marginLeft: 44,
  },
  proHint: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 16,
  },
});
