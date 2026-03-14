import { View, StyleSheet, TextInput } from "react-native";
import { DailySummary } from "../../components/home/DailySummary";
import { TransactionList } from "../../components/home/TransactionList";
import { useTransactions } from "../../hooks/useTransactions";

export default function HomeScreen() {
  const { data, isLoading } = useTransactions();

  return (
    <View style={styles.container}>
      <TextInput style={styles.search} placeholder="问一问：上周花了多少钱？" placeholderTextColor="#64748b" />
      <DailySummary transactions={data?.data ?? []} />
      <TransactionList transactions={data?.data ?? []} isLoading={isLoading} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  search: { margin: 16, padding: 12, backgroundColor: "#1e293b", borderRadius: 20, color: "#fff", fontSize: 14 },
});
