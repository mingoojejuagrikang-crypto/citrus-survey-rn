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

    const contentType = response.headers.get('content-type') ?? '';
    const rawText = await response.text();
    if (!contentType.includes('application/json')) {
      throw new Error('동기화 웹앱이 JSON을 반환하지 않습니다. doPost 배포 상태를 확인하세요.');
    }

    const payload = JSON.parse(rawText) as { success?: boolean; status?: string; message?: string };
    if (payload.success === false) {
      throw new Error(payload.message ?? '서버가 동기화를 거부했습니다.');
    }
    if (payload.status === 'error') {
      throw new Error(payload.message ?? '서버가 동기화를 거부했습니다.');
    }

    await databaseService.markSamplesSynced(pendingRows.map((row) => row.sampleId));
    return { syncedCount: pendingRows.length };
  }
}

export const syncService = new SyncService();
