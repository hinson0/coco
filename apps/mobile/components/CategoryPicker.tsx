import { Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useLocalCategories } from "../hooks/useLocalCategories";

const EXPENSE_ORDER = ['购物', '餐饮', '交通', '娱乐', '居住', '医疗', '教育', '其他支出'];
const HIDDEN_CATEGORIES = new Set(['通讯']);

interface Props {
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly type: "expense" | "income";
}

export function CategoryPicker({ selectedId, onSelect, type }: Props) {
  const router = useRouter();
  const { data: allCategories = [] } = useLocalCategories();
  const categories = allCategories
    .filter((c: any) => c.type === type && !HIDDEN_CATEGORIES.has(c.name))
    .sort((a: any, b: any) => {
      if (type !== 'expense') return 0;
      const ai = EXPENSE_ORDER.indexOf(a.name);
      const bi = EXPENSE_ORDER.indexOf(b.name);
      return (ai === -1 ? EXPENSE_ORDER.length - 1 : ai) - (bi === -1 ? EXPENSE_ORDER.length - 1 : bi);
    });

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.container}
    >
      {categories.map((cat: any) => (
        <TouchableOpacity
          key={cat.id}
          style={[styles.item, selectedId === cat.id && styles.itemActive]}
          onPress={() => onSelect(cat.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.icon}>{cat.icon}</Text>
          <Text style={[styles.name, selectedId === cat.id && styles.nameActive]}>{cat.name}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity
        style={styles.addItem}
        onPress={() => router.push({ pathname: "/category-manage", params: { type } })}
        activeOpacity={0.7}
      >
        <Text style={styles.addIcon}>+</Text>
        <Text style={styles.addName}>管理</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 16 },
  row: { flexDirection: "row", gap: 10, paddingVertical: 4 },
  item: {
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#F0F2F5",
    minWidth: 64,
  },
  itemActive: { backgroundColor: "#2D9B83" },
  icon: { fontSize: 22, marginBottom: 4 },
  name: { color: "#64748b", fontSize: 11 },
  nameActive: { color: "#fff" },
  addItem: {
    alignItems: "center" as const,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#F0F2F5",
    minWidth: 64,
    borderWidth: 1,
    borderStyle: "dashed" as const,
    borderColor: "#CBD5E1",
  },
  addIcon: { fontSize: 22, marginBottom: 4, color: "#94A3B8" },
  addName: { color: "#94A3B8", fontSize: 11 },
});
