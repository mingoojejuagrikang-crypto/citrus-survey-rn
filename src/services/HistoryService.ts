import { getHistoryCache, saveHistoryCache } from './DatabaseService';
import { downloadHistory } from './SheetsService';
import { DIFF_THRESHOLD_YELLOW, DIFF_THRESHOLD_RED } from '../utils/constants';
import { getConfig } from './DatabaseService';

export interface HistoryRecord {
  surveyDate: string;
  label: string;
  treatment: string;
  treeNo: number;
  fruitNo: number;
  measurements: Record<string, number>;
  [key: string]: unknown;
}

export async function fetchAndCacheHistory(
  farmName: string,
  year?: string
): Promise<void> {
  const webAppUrl = await getConfig('webAppUrl');
  if (!webAppUrl) return;

  const targetYear = year || new Date().getFullYear().toString();
  const data = await downloadHistory(webAppUrl, targetYear, farmName);

  for (const [sheetName, rows] of Object.entries(data)) {
    await saveHistoryCache(
      targetYear, farmName, sheetName, JSON.stringify(rows)
    );
  }
}

function parseHistoryRow(row: Record<string, unknown>): HistoryRecord | null {
  const surveyDate = String(row['조사일자'] || '');
  const label = String(row['라벨'] || '');
  const treatment = String(row['처리'] || row['처리구'] || '');
  const treeNo = Number(row['조사나무'] || row['나무'] || 0);
  const fruitNo = Number(row['조사과실'] || row['과실'] || 0);

  if (!surveyDate || !treeNo || !fruitNo) return null;

  const fixedKeys = new Set(['조사일자', '농가명', '라벨', '처리', '처리구', '조사나무', '조사과실', '비고', '조사자']);
  const measurements: Record<string, number> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!fixedKeys.has(k) && v !== '' && v !== null) {
      const num = Number(v);
      if (!isNaN(num)) measurements[k] = num;
    }
  }

  return { surveyDate, label, treatment, treeNo, fruitNo, measurements };
}

export async function getPreviousValues(
  farmName: string,
  label: string,
  treatment: string,
  treeNo: number,
  fruitNo: number,
  currentDate: string
): Promise<HistoryRecord | null> {
  const year = currentDate.slice(0, 4);
  const cached = await getHistoryCache(year, farmName);

  let candidates: HistoryRecord[] = [];

  for (const { data } of cached) {
    for (const rawRow of data) {
      const record = parseHistoryRow(rawRow as Record<string, unknown>);
      if (!record) continue;
      if (
        record.label === label &&
        record.treatment === treatment &&
        record.treeNo === treeNo &&
        record.fruitNo === fruitNo &&
        record.surveyDate < currentDate
      ) {
        candidates.push(record);
      }
    }
  }

  if (candidates.length === 0) return null;

  // 가장 최근 날짜
  candidates.sort((a, b) => b.surveyDate.localeCompare(a.surveyDate));
  return candidates[0];
}

export interface DiffResult {
  current: number;
  previous: number;
  diffPct: number;
  level: 'normal' | 'yellow' | 'red';
}

export function computeDiff(current: number, previous: number): DiffResult {
  const diffPct = previous !== 0 ? Math.abs((current - previous) / previous) : 0;
  let level: 'normal' | 'yellow' | 'red' = 'normal';
  if (diffPct >= DIFF_THRESHOLD_RED) level = 'red';
  else if (diffPct >= DIFF_THRESHOLD_YELLOW) level = 'yellow';
  return { current, previous, diffPct, level };
}
