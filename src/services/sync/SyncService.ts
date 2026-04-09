import { GOOGLE_SHEETS_ID } from '../../constants/app';
import { databaseService } from '../storage/DatabaseService';

class SyncService {
  async syncPending(webAppUrl: string) {
    const pendingRows = await databaseService.getPendingSyncRows();
    if (pendingRows.length === 0) {
      return { syncedCount: 0 };
    }

    const response = await fetch(webAppUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'upsertSamples',
        sheetId: GOOGLE_SHEETS_ID,
        rows: pendingRows.map((entry) => ({
          sheetName: entry.sheetName,
          values: entry.payload,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(`동기화 실패: ${response.status}`);
    }

    const payload = (await response.json()) as { success?: boolean };
    if (payload.success === false) {
      throw new Error('서버가 동기화를 거부했습니다.');
    }

    await databaseService.markSamplesSynced(pendingRows.map((row) => row.sampleId));
    return { syncedCount: pendingRows.length };
  }
}

export const syncService = new SyncService();
