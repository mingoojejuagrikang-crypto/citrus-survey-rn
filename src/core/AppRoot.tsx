import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../components/ActionButton';
import { colors } from '../constants/theme';
import { useAppBootstrap } from '../hooks/useAppBootstrap';
import { useAutoSync } from '../hooks/useAutoSync';
import { RootNavigator } from '../navigation/RootNavigator';
import { useSurveyStore } from '../store/surveyStore';

export function AppRoot() {
  useAppBootstrap();
  useAutoSync();

  const isBootstrapping = useSurveyStore((state) => state.isBootstrapping);
  const bootstrapError = useSurveyStore((state) => state.bootstrapError);
  const retryBootstrap = useSurveyStore((state) => state.retryBootstrap);

  if (isBootstrapping) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.text}>초기화 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <RootNavigator />
      {bootstrapError ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{bootstrapError}</Text>
          <ActionButton label="모델 재시도" onPress={retryBootstrap} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    flex: 1,
    gap: 12,
    justifyContent: 'center',
  },
  text: {
    color: colors.text,
    fontSize: 16,
  },
  banner: {
    backgroundColor: colors.danger,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bannerText: {
    color: colors.text,
    fontSize: 13,
    textAlign: 'center',
  },
});
