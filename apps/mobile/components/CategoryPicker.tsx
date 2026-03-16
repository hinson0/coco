import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useCategories } from "../hooks/useCategories";

interface Props {
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly type: "expense" | "income";
}

export function CategoryPicker({ selectedId, onSelect, type }: Props) {
  const { data } = useCategories();
  const categories = (data?.data ?? []).filter((c: any) => c.type === type);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>选择分类</Text>
      <ScrollView horizontal={false} contentContainerStyle={styles.grid}>
        {categories.map((cat: any) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.item, selectedId === cat.id && styles.itemActive]}
            onPress={() => onSelect(cat.id)}
          >
            <Text style={styles.icon}>{cat.icon}</Text>
            <Text style={[styles.name, selectedId === cat.id && styles.nameActive]}>{cat.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 16 },
  label: { color: "#94a3b8", fontSize: 12, marginBottom: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  item: { width: "22%", alignItems: "center", padding: 10, borderRadius: 12, backgroundColor: "#F0F2F5" },
  itemActive: { backgroundColor: "#2D9B83" },
  icon: { fontSize: 24, marginBottom: 4 },
  name: { color: "#64748b", fontSize: 10 },
  nameActive: { color: "#fff" },
});
