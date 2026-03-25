import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Card } from '../ui/Card';
import { AppText } from '../ui/AppText';
import { colors } from '../../constants/theme';
import type { RankedTransaction } from '../../utils/statsUtils';

interface TransactionRankCardProps {
  readonly expenseTransactions: RankedTransaction[];
  readonly incomeTransactions: RankedTransaction[];
}

/**
 * 将 "2026-03-22" 格式转成 "03月22日"
 */
function formatDate(dateStr: string): string {
  const month = dateStr.slice(5, 7);   // "03"
  const day = dateStr.slice(8, 10);    // "22"
  return `${month}月${day}日`;
}

const MAX_VISIBLE = 3;
const MAX_EXPANDED = 10;

export function TransactionRankCard({
  expenseTransactions,
  incomeTransactions,
}: TransactionRankCardProps) {
  const [tab, setTab] = useState<'expense' | 'income'>('expense');
  const [expanded, setExpanded] = useState(false);

  const data = tab === 'expense' ? expenseTransactions : incomeTransactions;
  const visible = expanded ? data.slice(0, MAX_EXPANDED) : data.slice(0, MAX_VISIBLE);

  return (
    <Card radius="lg" shadow="md" padding={16}>
      {/* Header */}
      <View style={styles.header}>
        <AppText size="lg" weight="semibold" color={colors.text}>
          明细排行榜
        </AppText>
        <View style={styles.tabs}>
          {(['expense', 'income'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => {
                setTab(t);
                setExpanded(false);
              }}
              style={[styles.tab, tab === t && styles.tabActive]}
            >
              <AppText
                size="sm"
                weight="semibold"
                color={tab === t ? colors.white : colors.textLighter}
              >
                {t === 'expense' ? '支出' : '收入'}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Rank list */}
      {data.length > 0 ? (
        <View style={styles.list}>
          {visible.map((item, index) => (
            <View key={item.id}>
              {/* 主行 */}
              <View style={styles.rankRow}>
                {/* 序号 */}
                <AppText size="sm" color={colors.textLighter} style={styles.rankNum}>
                  {index + 1}
                </AppText>

                {/* 分类图标 */}
                <AppText size="xl" style={styles.emoji}>
                  {item.categoryEmoji}
                </AppText>

                {/* 分类名称 */}
                <AppText size="md" weight="semibold" color={colors.text} style={styles.categoryName}>
                  {item.categoryName}
                </AppText>

                {/* 金额（右对齐） */}
                <AppText
                  size="sm"
                  weight="semibold"
                  color={tab === 'expense' ? colors.coral : colors.sage}
                >
                  {tab === 'expense' ? '-' : '+'}¥
                  {item.amount.toLocaleString('zh-CN', {
                    maximumFractionDigits: 0,
                  })}
                </AppText>
              </View>
              {/* 日期/备注行 */}
              <View style={styles.detailRow}>
                <AppText size="xs" color={colors.textLighter} numberOfLines={1}>
                  {formatDate(item.date)}
                  {item.note ? ` · ${item.note}` : ''}
                </AppText>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <AppText size="xl" color={colors.textLighter} style={styles.empty}>
          暂无数据
        </AppText>
      )}

      {/* Expand toggle */}
      {data.length > MAX_VISIBLE && (
        <Pressable onPress={() => setExpanded(!expanded)} style={styles.expandBtn}>
          <AppText size="sm" color={colors.textLighter}>
            {expanded ? '↑ 收起' : '↓ 查看更多'}
          </AppText>
        </Pressable>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.creamDark,
    borderRadius: 12,
    padding: 2,
  },
  tab: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: colors.coral,
  },
  list: {
    gap: 4,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  rankNum: {
    width: 16,
    textAlign: 'center',
  },
  emoji: {
    width: 28,
    textAlign: 'center',
  },
  categoryName: {
    flex: 1,
  },
  detailRow: {
    marginLeft: 52, // rankNum(16) + gap(8) + emoji(28)
    marginBottom: 8,
  },
  empty: {
    textAlign: 'center',
    marginVertical: 20,
  },
  expandBtn: {
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 4,
  },
});
