import { useState, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { VoiceRecorder } from "./VoiceRecorder";

interface Props {
  readonly onSendText: (text: string) => void;
  readonly onSendImage: (base64: string) => void;
  readonly onSendAudio: (base64: string) => void;
  readonly isLoading: boolean;
  readonly onManualEntry?: () => void;
}

export function ChatInput({ onSendText, onSendImage, onSendAudio, isLoading, onManualEntry }: Props) {
  const [text, setText] = useState("");
  const inputRef = useRef<TextInput>(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSendText(trimmed);
    setText("");
  };

  const handleCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") return;

    const result = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0].base64) {
      onSendImage(result.assets[0].base64);
    }
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.chips}>
        <TouchableOpacity style={styles.chip} onPress={onManualEntry}>
          <Text style={styles.chipText}>✏️ 手动记账</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.chip}>
          <Text style={styles.chipText}>💬 问一问</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.inputRow}>
        <TouchableOpacity style={styles.iconBtn} onPress={handleCamera}>
          <Text style={{ fontSize: 20 }}>📷</Text>
        </TouchableOpacity>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="发消息或按住说话..."
          placeholderTextColor="#94a3b8"
          returnKeyType="send"
          onSubmitEditing={handleSend}
          editable={!isLoading}
        />
        {text.trim() ? (
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={isLoading}>
            <Text style={styles.sendText}>↑</Text>
          </TouchableOpacity>
        ) : (
          <VoiceRecorder onRecorded={onSendAudio} disabled={isLoading} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderTopWidth: 1, borderTopColor: "#E5E7EB", paddingTop: 8, paddingHorizontal: 12, paddingBottom: 20, backgroundColor: "#fff" },
  chips: { flexDirection: "row", gap: 6, marginBottom: 8 },
  chip: { backgroundColor: "#F0F2F5", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  chipText: { color: "#2D9B83", fontSize: 11, fontWeight: "500" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F0F2F5", justifyContent: "center", alignItems: "center" },
  input: { flex: 1, backgroundColor: "#F0F2F5", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, color: "#1e293b", fontSize: 14 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#2D9B83", justifyContent: "center", alignItems: "center" },
  sendText: { color: "#fff", fontSize: 18, fontWeight: "700" },
});
