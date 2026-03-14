import { useState } from "react";
import { View, FlatList, StyleSheet, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { useChatStore } from "../store/chatStore";
import { useChat } from "../hooks/useChat";
import { ChatMessage } from "../components/chat/ChatMessage";
import { ChatInput } from "../components/chat/ChatInput";
import { ManualEntryForm } from "../components/ManualEntryForm";

export default function ChatScreen() {
  const { messages, isLoading } = useChatStore();
  const { sendText, sendOcr, sendAsr } = useChat();
  const [showManual, setShowManual] = useState(false);
  const { addMessage } = useChatStore();

  const handleManualSuccess = (tx: any) => {
    addMessage({
      id: Date.now().toString(), user_id: "", role: "assistant",
      content_type: "bill_card", content: JSON.stringify(tx),
      transaction_id: tx.id, created_at: new Date().toISOString(),
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>✦ CoCo AI</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Chat messages */}
      <FlatList
        data={[...messages].reverse()}
        inverted
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatMessage message={item} />}
        contentContainerStyle={styles.list}
      />

      {/* Input */}
      <ChatInput
        onSendText={sendText}
        onSendImage={sendOcr}
        onSendAudio={sendAsr}
        isLoading={isLoading}
        onManualEntry={() => setShowManual(true)}
      />

      {/* Manual entry form */}
      <ManualEntryForm
        visible={showManual}
        onClose={() => setShowManual(false)}
        onSuccess={handleManualSuccess}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12, backgroundColor: "#1e1b4b" },
  back: { color: "#fff", fontSize: 20 },
  title: { color: "#fff", fontSize: 18, fontWeight: "700" },
  list: { padding: 12 },
});
