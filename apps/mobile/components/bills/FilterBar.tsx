import { ScrollView, View, StyleSheet } from 'react-native';
import { Chip } from '../ui/Chip';

export const ALL_EXPENSE = '__all_expense__';
export const ALL_INCOME = '__all_income__';

interface FilterCategory {
  readonly id: string;
  readonly name: string;
  readonly type?: 'expense' | 'income';
}

interface FilterBarProps {
  readonly categories: readonly FilterCategory[];
  readonly activeId: string;
  readonly onSelect: (id: string) => void;
  readonly wrap?: boolean;
}

export function FilterBar({ categories, activeId, onSelect, wrap = false }: FilterBarProps) {
  const renderChip = (cat: FilterCategory) => (
    <Chip
      key={cat.id}
      label={cat.name}
      active={activeId === cat.id}
      onPress={() => onSelect(cat.id)}
    />
  );

  if (wrap) {
    const expenses = categories.filter(c => c.type === 'expense');
    const incomes = categories.filter(c => c.type === 'income');
    const untyped = categories.filter(c => !c.type);

    return (
      <View style={styles.wrapContainer}>
        <View style={styles.wrapRow}>
          <Chip label="全部支出" active={activeId === ALL_EXPENSE} onPress={() => onSelect(ALL_EXPENSE)} />
          {expenses.map(renderChip)}
          {untyped.map(renderChip)}
        </View>
        {incomes.length > 0 && (
          <>
            <View style={styles.divider} />
            <View style={styles.wrapRow}>
              <Chip label="全部收入" active={activeId === ALL_INCOME} onPress={() => onSelect(ALL_INCOME)} />
              {incomes.map(renderChip)}
            </View>
          </>
        )}
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
    >
      <Chip label="全部" active={activeId === ALL_EXPENSE} onPress={() => onSelect(ALL_EXPENSE)} />
      {categories.map(renderChip)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  wrapContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 12,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e0d8cf',
  },
});
