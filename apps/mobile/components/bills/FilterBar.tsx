import { ScrollView, StyleSheet } from 'react-native';
import { Chip } from '../ui/Chip';

interface FilterBarProps {
  readonly categories: Array<{ id: string; name: string }>;
  readonly activeId: string | null;
  readonly onSelect: (id: string | null) => void;
}

export function FilterBar({ categories, activeId, onSelect }: FilterBarProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      <Chip
        label="全部"
        active={activeId === null}
        onPress={() => onSelect(null)}
      />
      {categories.map(cat => (
        <Chip
          key={cat.id}
          label={cat.name}
          active={activeId === cat.id}
          onPress={() => onSelect(cat.id)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
