import { GOOGLE_SHEETS_ID } from '../../constants/app';
import { databaseService } from '../storage/DatabaseService';
import { parseSyncHttpResponse } from './syncParsers';

type SyncTransport = 'json' | 'form';

class SyncService {
  private async postRows(
    webAppUrl: string,
    rows: Array<{ sheetName: string; values: Record<string, string | number | null> }>,
    transport: SyncTransport
  ) {
    if (transport === 'json') {
      return fetch(webAppUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'upsertSamples',
          sheetId: GOOGLE_SHEETS_ID,
          rows,
        }),
      });
    }

    const body = new URLSearchParams({
      action: 'upsertSamples',
      sheetId: GOOGLE_SHEETS_ID,
      rows: JSON.stringify(rows),
    });
    return fetch(webAppUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
  }

  async syncPending(webAppUrl: string) {
    const pendingRows = await databaseService.getPendingSyncRows();
    if (pendingRows.length === 0) {
      return { syncedCount: 0 };
    }

    const rows = pendingRows.map((entry) => ({
      sheetName: entry.sheetName,
      values: entry.payload,
    }));

    const attempts: string[] = [];
    for (const transport of ['json', 'form'] as const) {
      const response = await this.postRows(webAppUrl, rows, transport);
      const rawText = await response.text();
      const parsed = parseSyncHttpResponse(
        response.status,
        response.headers.get('content-type') ?? '',
        rawText
      );
      if (parsed.ok) {
        await databaseService.markSamplesSynced(pendingRows.map((row) => row.sampleId));
        return { syncedCount: pendingRows.length };
      }
      attempts.push(`${transport}: ${parsed.message}`);
    }

    throw new Error(`동기화 실패. 시도 결과: ${attempts.join(' | ')}`);
  }
}

export const syncService = new SyncService();
