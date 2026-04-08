import NetInfo from '@react-native-community/netinfo';
import {
  getUnsyncedSamples,
  getMeasurementsMap,
  markSampleSynced,
  getConfig,
} from './DatabaseService';
import { syncToSheets, SheetsRow } from './SheetsService';

let syncInProgress = false;
let unsubscribe: (() => void) | null = null;

export function startNetworkWatcher(onSyncComplete?: (count: number) => void) {
  if (unsubscribe) return;

  unsubscribe = NetInfo.addEventListener(async state => {
    if (state.isConnected && !syncInProgress) {
      await runSync(onSyncComplete);
    }
  });
}

export function stopNetworkWatcher() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}

export async function runSync(onComplete?: (count: number) => void): Promise<number> {
  if (syncInProgress) return 0;

  const webAppUrl = await getConfig('webAppUrl');
  if (!webAppUrl) return 0;

  const netState = await NetInfo.fetch();
  if (!netState.isConnected) return 0;

  syncInProgress = true;
  let syncedCount = 0;

  try {
    const unsynced = await getUnsyncedSamples();
    if (unsynced.length === 0) return 0;

    const rows: SheetsRow[] = [];
    for (const sample of unsynced) {
      const measurements = await getMeasurementsMap(sample.sample_id);
      rows.push({
        surveyDate: sample.survey_date,
        surveyType: sample.survey_type,
        farmName: sample.farm_name,
        label: sample.label,
        treatment: sample.treatment,
        treeNo: sample.tree_no,
        fruitNo: sample.fruit_no,
        measurements,
        memo: sample.memo,
        observer: sample.observer,
      });
    }

    // 배치 전송
    const BATCH_SIZE = 50;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const batchSamples = unsynced.slice(i, i + BATCH_SIZE);
      await syncToSheets(webAppUrl, batch);
      for (const sample of batchSamples) {
        await markSampleSynced(sample.sample_id);
        syncedCount++;
      }
    }

    onComplete?.(syncedCount);
    return syncedCount;
  } catch (err) {
    console.warn('Sync failed:', err);
    return 0;
  } finally {
    syncInProgress = false;
  }
}

export async function getUnsyncedCount(): Promise<number> {
  const unsynced = await getUnsyncedSamples();
  return unsynced.length;
}
