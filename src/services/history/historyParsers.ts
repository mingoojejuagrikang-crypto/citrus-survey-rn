import { MEASUREMENT_ITEM_LABELS } from '../../constants/items';
import type { HistoryCacheRow, MeasurementItemName } from '../../types/domain';

export type RawHistoryResponse = {
  status?: string;
  data?: Record<string, Array<Record<string, string | number>>>;
  rows?: Array<Record<string, string | number>>;
};

export function flattenHistoryResponse(body: RawHistoryResponse): Array<Record<string, string | number>> {
  return body.rows ?? Object.values(body.data ?? {}).flatMap((group) => group);
}

export function normalizeHistoryRows(
  rows: Array<Record<string, string | number>>,
  fallbackFarm: string
): HistoryCacheRow[] {
  return rows
    .flatMap<HistoryCacheRow>((row) => {
      const base = {
        surveyDate: String(row.survey_date ?? row.조사일자 ?? ''),
        farmName: String(row.farm_name ?? row.농가명 ?? fallbackFarm),
        label: String(row.label ?? row.라벨 ?? ''),
        treatment: String(row.treatment ?? row.처리 ?? row.처리구 ?? ''),
        treeNo: Number(row.tree_no ?? row.조사나무 ?? 0),
        fruitNo: Number(row.fruit_no ?? row.조사과실 ?? 0),
      };

      const derivedRows = MEASUREMENT_ITEM_LABELS.flatMap<HistoryCacheRow>((itemName) => {
        const rawValue = row[itemName];
        return typeof rawValue === 'number'
          ? [
              {
                ...base,
                itemName: itemName as MeasurementItemName,
                value: rawValue,
              },
            ]
          : [];
      });
      if (derivedRows.length > 0) {
        return derivedRows;
      }

      const itemName = row.item_name ?? row.항목;
      const value = row.value ?? row.값;
      if (
        typeof itemName === 'string' &&
        typeof value === 'number' &&
        MEASUREMENT_ITEM_LABELS.includes(itemName as MeasurementItemName)
      ) {
        return [
          {
            ...base,
            itemName: itemName as MeasurementItemName,
            value,
          },
        ];
      }

      return [];
    })
    .filter((row) => !Number.isNaN(row.treeNo) && !Number.isNaN(row.fruitNo));
}
