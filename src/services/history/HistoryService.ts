import { MEASUREMENT_ITEM_LABELS } from '../../constants/items';
import type { HistoryCacheRow, MeasurementItemName } from '../../types/domain';
import { databaseService } from '../storage/DatabaseService';

type RawHistoryResponse =
  | Array<Record<string, string | number>>
  | {
      rows?: Array<Record<string, string | number>>;
    };

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
    const rows = Array.isArray(body) ? body : body.rows ?? [];

    const normalized = rows
      .map<HistoryCacheRow | null>((row) => {
        const itemName = row.item_name ?? row.항목;
        const value = row.value ?? row.값;
        if (typeof itemName !== 'string' || typeof value !== 'number') {
          return null;
        }

        if (!MEASUREMENT_ITEM_LABELS.includes(itemName as MeasurementItemName)) {
          return null;
        }

        return {
          surveyDate: String(row.survey_date ?? row.조사일자 ?? ''),
          farmName: String(row.farm_name ?? row.농가명 ?? farm),
          label: String(row.label ?? row.라벨 ?? ''),
          treatment: String(row.treatment ?? row.처리구 ?? ''),
          treeNo: Number(row.tree_no ?? row.조사나무 ?? 0),
          fruitNo: Number(row.fruit_no ?? row.조사과실 ?? 0),
          itemName: itemName as MeasurementItemName,
          value,
        };
      })
      .filter((row): row is HistoryCacheRow => row !== null);

    await databaseService.saveHistoryCache(normalized);
    return normalized.length;
  }
}

export const historyService = new HistoryService();
