import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

import { databaseService } from '../services/storage/DatabaseService';
import { syncService } from '../services/sync/SyncService';
import { useSettingsStore } from '../store/settingsStore';
import { useSurveyStore } from '../store/surveyStore';

export function useAutoSync() {
  const webAppUrl = useSettingsStore((state) => state.webAppUrl);
  const setProgressSummary = useSurveyStore((state) => state.setProgressSummary);
  const setLastSyncMessage = useSurveyStore((state) => state.setLastSyncMessage);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (!state.isConnected || !webAppUrl) {
        return;
      }

      void (async () => {
        try {
          const result = await syncService.syncPending(webAppUrl);
          const summary = await databaseService.getProgressSummary();
          setProgressSummary(summary);
          setLastSyncMessage(
            result.syncedCount > 0 ? `${result.syncedCount}건을 동기화했습니다.` : '동기화할 데이터가 없습니다.'
          );
        } catch (error) {
          setLastSyncMessage(error instanceof Error ? error.message : '동기화 오류');
        }
      })();
    });

    return unsubscribe;
  }, [setLastSyncMessage, setProgressSummary, webAppUrl]);
}
