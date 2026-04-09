import { useCallback, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../components/ActionButton';
import { Panel } from '../components/Panel';
import { colors } from '../constants/theme';
import { databaseService } from '../services/storage/DatabaseService';
import { syncService } from '../services/sync/SyncService';
import { useSettingsStore } from '../store/settingsStore';
import { useSurveyStore } from '../store/surveyStore';

export function ProgressScreen() {
  const webAppUrl = useSettingsStore((state) => state.webAppUrl);
  const progressSummary = useSurveyStore((state) => state.progressSummary);
  const lastSyncMessage = useSurveyStore((state) => state.lastSyncMessage);
  const setProgressSummary = useSurveyStore((state) => state.setProgressSummary);
  const setLastSyncMessage = useSurveyStore((state) => state.setLastSyncMessage);

  const refresh = useCallback(async () => {
    const summary = await databaseService.getProgressSummary();
    setProgressSummary(summary);
  }, [setProgressSummary]);

  const syncNow = useCallback(async () => {
    try {
      const result = await syncService.syncPending(webAppUrl);
      setLastSyncMessage(`${result.syncedCount}건 동기화 완료`);
      await refresh();
    } catch (error) {
      setLastSyncMessage(error instanceof Error ? error.message : '동기화 실패');
    }
  }, [refresh, setLastSyncMessage, webAppUrl]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <View style={styles.screen}>
      <Panel style={styles.card}>
        <Text style={styles.title}>진행률</Text>
        <Text style={styles.metric}>총 샘플 {progressSummary.totalSamples}건</Text>
        <Text style={styles.metric}>동기화 대기 {progressSummary.pendingSamples}건</Text>
        <Text style={styles.metric}>동기화 완료 {progressSummary.syncedSamples}건</Text>
        <Text style={styles.help}>
          최근 동기화: {progressSummary.lastSyncedAt ?? '없음'}
        </Text>
      </Panel>
      <Panel style={styles.card}>
        <Text style={styles.title}>상태</Text>
        <Text style={styles.help}>{lastSyncMessage || '대기 중'}</Text>
      </Panel>
      <View style={styles.actions}>
        <ActionButton label="새로고침" onPress={() => void refresh()} variant="secondary" />
        <ActionButton label="지금 동기화" onPress={() => void syncNow()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.bg,
    flex: 1,
    gap: 12,
    padding: 12,
  },
  card: {
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  metric: {
    color: colors.text,
    fontSize: 16,
  },
  help: {
    color: colors.subtext,
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
});
