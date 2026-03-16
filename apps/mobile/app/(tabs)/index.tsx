import { View, StyleSheet } from "react-native";
import { DailySummary } from "../../components/home/DailySummary";
import { TransactionList } from "../../components/home/TransactionList";
import { useTransactions } from "../../hooks/useTransactions";

export default function HomeScreen() {
  const { data, isLoading } = useTransactions();

  return (
    <View style={styles.container}>
      <DailySummary transactions={data?.data ?? []} />
      <TransactionList transactions={data?.data ?? []} isLoading={isLoading} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },
});
