import { View, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useOfflineContext } from '../lib/offline-context';
import { AppText } from '../components/ui/AppText';
import { Card } from '../components/ui/Card';
import { colors } from '../constants/theme';

function useBudgetMonthsDetail() {
  const { db } = useOfflineContext();

  return useQuery({
    queryKey: ['transactions', 'budget-months-detail'],
    queryFn: async () => {
      if (!db) return { total: 0, months: [] as { month: string; count: number }[] };

      const rows = await db.getAllAsync<{ month: string; count: number }>(
        "SELECT strftime('%Y-%m', occurred_at) as month, COUNT(*) as count FROM transactions WHERE deleted_at IS NULL GROUP BY month ORDER BY month DESC"
      );

      return { total: rows.length, months: rows };
    },
    enabled: !!db,
  });
}

export default function BudgetMonthsDetailScreen() {
  const insets = useSafeAreaInsets();
  const { data } = useBudgetMonthsDetail();
  const total = data?.total ?? 0;
  const months = data?.months ?? [];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <AppText size="2xl" onPress={() => router.back()} style={styles.back}>←</AppText>
        <AppText size="xl" weight="semibold">预算达标月</AppText>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* 数字展示 */}
        <View style={styles.heroSection}>
          <AppText style={styles.heroNumber}>{total}</AppText>
          <AppText size="xl" color={colors.textLight}>月</AppText>
        </View>

        {/* 计算规则 */}
        <AppText size="base" color={colors.textLighter} weight="semibold" style={styles.sectionTitle}>
          计算规则
        </AppText>
        <Card style={styles.ruleCard}>
          <View style={styles.ruleRow}>
            <AppText size="2xl" style={styles.ruleIcon}>📊</AppText>
            <View style={styles.ruleText}>
              <AppText size="xl" weight="medium">统计有记账的月份</AppText>
              <AppText size="base" color={colors.textLight} style={styles.ruleDesc}>
                系统统计所有有过记账记录的不同月份数量
              </AppText>
            </View>
          </View>
          <View style={styles.ruleSeparator} />
          <View style={styles.ruleRow}>
            <AppText size="2xl" style={styles.ruleIcon}>✅</AppText>
            <View style={styles.ruleText}>
              <AppText size="xl" weight="medium">当月有记录即计入</AppText>
              <AppText size="base" color={colors.textLight} style={styles.ruleDesc}>
                只要某个月有任意一笔记账记录，该月即被计入
              </AppText>
            </View>
          </View>
          <View style={styles.ruleSeparator} />
          <View style={styles.ruleRow}>
            <AppText size="2xl" style={styles.ruleIcon}>🎯</AppText>
            <View style={styles.ruleText}>
              <AppText size="xl" weight="medium">坚持记账的里程碑</AppText>
              <AppText size="base" color={colors.textLight} style={styles.ruleDesc}>
                月数越多，说明你的记账习惯越持久
              </AppText>
            </View>
          </View>
        </Card>

        {/* 各月记账详情 */}
        <AppText size="base" color={colors.textLighter} weight="semibold" style={styles.sectionTitle}>
          各月记账情况
        </AppText>
        <Card padding={0}>
          {months.map((item, index) => (
            <View key={item.month}>
              {index > 0 && <View style={styles.monthSeparator} />}
              <View style={styles.monthRow}>
                <AppText size="xl" weight="medium">{item.month}</AppText>
                <AppText size="base" color={colors.textLight}>{item.count} 笔</AppText>
              </View>
            </View>
          ))}
          {months.length === 0 && (
            <View style={styles.monthRow}>
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
  heroNumber: { fontSize: 56, fontWeight: '800', color: colors.honey },
  sectionTitle: { paddingTop: 14, paddingBottom: 6, paddingHorizontal: 4 },
  ruleCard: { gap: 0 },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 4 },
  ruleIcon: { width: 32, textAlign: 'center' },
  ruleText: { flex: 1, gap: 2 },
  ruleDesc: { marginTop: 2 },
  ruleSeparator: { height: 1, backgroundColor: colors.creamDark, marginVertical: 10, marginLeft: 44 },
  monthSeparator: { height: 1, backgroundColor: colors.creamDark, marginHorizontal: 18 },
  monthRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 18,
  },
});
