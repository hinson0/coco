import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useOfflineContext } from "@/lib/offline-context";
import { getCount } from "@/lib/queue/operation-queue";

export function SyncIndicator() {
  const { db } = useOfflineContext();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!db) return;

    const check = async () => {
      const count = await getCount(db);
      setPendingCount(count);
    };

    check();
    const interval = setInterval(check, 2000);
    return () => clearInterval(interval);
  }, [db]);

  if (pendingCount === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        {pendingCount} 条待同步
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 50,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    zIndex: 999,
  },
  text: {
    color: "#fff",
    fontSize: 12,
  },
});
