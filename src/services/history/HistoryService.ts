import { databaseService } from '../storage/DatabaseService';
import { flattenHistoryResponse, normalizeHistoryRows, type RawHistoryResponse } from './historyParsers';

class HistoryService {
  async restore(year: number, farm: string, webAppUrl: string) {
    const params = new URLSearchParams({
      year: String(year),
      farm,
    });
    const response = await fetch(`${webAppUrl}?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`과거값 복구 실패: ${response.status}`);
    }

    const body = (await response.json()) as RawHistoryResponse;
    const rows = flattenHistoryResponse(body);
    const normalized = normalizeHistoryRows(rows, farm);

    await databaseService.saveHistoryCache(normalized);
    return normalized.length;
  }
}

export const historyService = new HistoryService();
