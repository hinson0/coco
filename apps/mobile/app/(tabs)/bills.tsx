import { View } from 'react-native';
import { AppText } from '../../components/ui/AppText';
import { colors } from '../../constants/theme';

export default function BillsScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }}>
      <AppText size="4xl" weight="bold">账单</AppText>
    </View>
  );
}
