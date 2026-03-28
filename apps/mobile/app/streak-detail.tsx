import { View, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useOfflineContext } from '../lib/offline-context';
import { AppText } from '../components/ui/AppText';
import { Card } from '../components/ui/Card';
import { colors } from '../constants/theme';

function useStreakDetail() {
  const { db } = useOfflineContext();

  return useQuery({
    queryKey: ['transactions', 'streak-detail'],
    queryFn: async () => {
      if (!db) return { streak: 0, recentDays: [] as { day: string; count: number }[] };

      const dayRows = await db.getAllAsync<{ day: string; count: number }>(
        "SELECT date(occurred_at) as day, COUNT(*) as count FROM transactions WHERE deleted_at IS NULL GROUP BY day ORDER BY day DESC LIMIT 30"
      );

      const daySet = new Set(dayRows.map((r) => r.day));
      let streak = 0;
      const today = new Date();
      for (let i = 0; i < 365; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (daySet.has(key)) {
          streak += 1;
        } else {
          break;
        }
      }

      return { streak, recentDays: dayRows.slice(0, 14) };
    },
    enabled: !!db,
  });
}

export default function StreakDetailScreen() {
  const insets = useSafeAreaInsets();
  const { data } = useStreakDetail();
  const streak = data?.streak ?? 0;
  const recentDays = data?.recentDays ?? [];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <AppText size="2xl" onPress={() => router.back()} style={styles.back}>←</AppText>
        <AppText size="xl" weight="semibold">连续记账</AppText>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* 数字展示 */}
        <View style={styles.heroSection}>
          <AppText style={styles.heroNumber}>{streak}</AppText>
          <AppText size="xl" color={colors.textLight}>天</AppText>
        </View>

        {/* 计算规则 */}
        <AppText size="base" color={colors.textLighter} weight="semibold" style={styles.sectionTitle}>
          计算规则
        </AppText>
        <Card style={styles.ruleCard}>
          <View style={styles.ruleRow}>
            <AppText size="2xl" style={styles.ruleIcon}>📅</AppText>
            <View style={styles.ruleText}>
              <AppText size="xl" weight="medium">从今天开始往回数</AppText>
              <AppText size="base" color={colors.textLight} style={styles.ruleDesc}>
                系统从今天开始，逐天往前检查是否有记账记录
              </AppText>
            </View>
          </View>
          <View style={styles.ruleSeparator} />
          <View style={styles.ruleRow}>
            <AppText size="2xl" style={styles.ruleIcon}>✅</AppText>
            <View style={styles.ruleText}>
              <AppText size="xl" weight="medium">有记录则计入连续</AppText>
              <AppText size="base" color={colors.textLight} style={styles.ruleDesc}>
                当天有任意一笔记账，即算作连续记账的一天
              </AppText>
            </View>
          </View>
          <View style={styles.ruleSeparator} />
          <View style={styles.ruleRow}>
            <AppText size="2xl" style={styles.ruleIcon}>⛔</AppText>
            <View style={styles.ruleText}>
              <AppText size="xl" weight="medium">中断则停止计数</AppText>
              <AppText size="base" color={colors.textLight} style={styles.ruleDesc}>
                遇到没有记账的那天，连续天数停止累计
              </AppText>
            </View>
          </View>
        </Card>

        {/* 近期记账记录 */}
        <AppText size="base" color={colors.textLighter} weight="semibold" style={styles.sectionTitle}>
          近期记账天数
        </AppText>
        <Card padding={0}>
          {recentDays.map((day, index) => (
            <View key={day.day}>
              {index > 0 && <View style={styles.daySeparator} />}
              <View style={styles.dayRow}>
                <AppText size="xl" weight="medium">{day.day}</AppText>
                <AppText size="base" color={colors.textLight}>{day.count} 笔</AppText>
              </View>
            </View>
          ))}
          {recentDays.length === 0 && (
            <View style={styles.dayRow}>
              <AppText size="base" color={colors.textLighter}>暂无记账记录</AppText>
            </View>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  back: { width: 36 },
  placeholder: { width: 36 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  heroSection: {
    alignItems: 'center', paddingVertical: 30, flexDirection: 'row',
    justifyContent: 'center', gap: 4,
  },
  heroNumber: { fontSize: 56, fontWeight: '800', color: colors.sage },
  sectionTitle: { paddingTop: 14, paddingBottom: 6, paddingHorizontal: 4 },
  ruleCard: { gap: 0 },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 4 },
  ruleIcon: { width: 32, textAlign: 'center' },
  ruleText: { flex: 1, gap: 2 },
  ruleDesc: { marginTop: 2 },
  ruleSeparator: { height: 1, backgroundColor: colors.creamDark, marginVertical: 10, marginLeft: 44 },
  daySeparator: { height: 1, backgroundColor: colors.creamDark, marginHorizontal: 18 },
  dayRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 18,
  },
});
