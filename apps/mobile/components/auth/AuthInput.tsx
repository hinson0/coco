import { useState } from "react";
import { TextInput, StyleSheet, type TextInputProps } from "react-native";
import { colors } from "../../constants/theme";

interface AuthInputProps {
  readonly placeholder: string;
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly secureTextEntry?: boolean;
  readonly keyboardType?: TextInputProps["keyboardType"];
  readonly autoCapitalize?: TextInputProps["autoCapitalize"];
}

export function AuthInput({
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize = "none",
}: AuthInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <TextInput
      style={[styles.input, isFocused && styles.inputFocused]}
      placeholder={placeholder}
      placeholderTextColor={colors.textLighter}
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.creamDeeper,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 16,
    fontSize: 14,
    color: colors.text,
  },
  inputFocused: {
    borderColor: colors.sageLight,
  },
});
