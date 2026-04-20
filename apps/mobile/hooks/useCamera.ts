import { useCallback } from "react";
import { Alert, Linking } from "react-native";
import * as ImagePicker from "expo-image-picker";

export function useCamera() {
  const pickImage = useCallback(async (): Promise<string | null> => {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();

    if (!granted) {
      Alert.alert("需要相机权限", "请在系统设置中允许 Coco 访问相机", [
        { text: "取消", style: "cancel" },
        { text: "去设置", onPress: () => Linking.openSettings() },
      ]);
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.6,
    });

    if (result.canceled) return null;
    return result.assets[0].base64 ?? null;
  }, []);

  const pickFromLibrary = useCallback(async (): Promise<string | null> => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!granted) {
      Alert.alert("需要相册权限", "请在系统设置中允许 Coco 访问相册", [
        { text: "取消", style: "cancel" },
        { text: "去设置", onPress: () => Linking.openSettings() },
      ]);
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      base64: true,
      quality: 0.6,
    });

    if (result.canceled) return null;
    return result.assets[0].base64 ?? null;
  }, []);

  return { pickImage, pickFromLibrary };
}
