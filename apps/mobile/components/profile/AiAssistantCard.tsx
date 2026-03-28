import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { AppText } from '../ui/AppText';
import { colors, shadows } from '../../constants/theme';

export function AiAssistantCard() {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={() => router.push('/')}>
      <LinearGradient
        colors={[colors.sagePale, '#edf6f0']}
        style={styles.container}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.row}>
          <View style={styles.avatar}>
            <AppText size="2xl">🌿</AppText>
          </View>
          <View style={styles.info}>
            <AppText size="xl" weight="bold" color={colors.sage}>棉花助手</AppText>
            <AppText size="base" color={colors.textLight} style={styles.desc}>
              AI 智能记账，随时随地
            </AppText>
          </View>
          <AppText size="2xl" color={colors.sage}>›</AppText>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    padding: 18,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  desc: {
    marginTop: 1,
  },
});
