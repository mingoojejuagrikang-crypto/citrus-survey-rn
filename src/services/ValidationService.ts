import { DEFAULT_VALUE_RANGES } from '../utils/constants';
import { getConfig } from './DatabaseService';

export interface RangeResult {
  inRange: boolean;
  min: number;
  max: number;
}

// DB의 value_ranges 테이블 기반 범위 조회
let cachedRanges: Record<string, { min: number; max: number }> | null = null;

export async function getRanges(): Promise<Record<string, { min: number; max: number }>> {
  if (cachedRanges) return cachedRanges;
  try {
    const { getDB } = await import('./DatabaseService');
    const db = await getDB();
    const rows = await db.getAllAsync<{ item_name: string; min_value: number; max_value: number }>(
      'SELECT item_name, min_value, max_value FROM value_ranges'
    );
    const result: Record<string, { min: number; max: number }> = { ...DEFAULT_VALUE_RANGES };
    rows.forEach(r => { result[r.item_name] = { min: r.min_value, max: r.max_value }; });
    cachedRanges = result;
    return result;
  } catch {
    return { ...DEFAULT_VALUE_RANGES };
  }
}

export function invalidateRangeCache() {
  cachedRanges = null;
}

export async function checkRange(field: string, value: number): Promise<RangeResult> {
  const ranges = await getRanges();
  const r = ranges[field];
  if (!r) return { inRange: true, min: 0, max: Infinity };
  return { inRange: value >= r.min && value <= r.max, min: r.min, max: r.max };
}

// 필수 설정값 체크
export interface RequiredCheckResult {
  ok: boolean;
  missing: string[];
  message: string;
}

export function checkRequired(params: {
  observer: string;
  farmName: string;
  surveyType: string;
  webAppUrl: string;
}): RequiredCheckResult {
  const missing: string[] = [];
  if (!params.observer?.trim()) missing.push('조사자 이름');
  if (!params.farmName?.trim()) missing.push('농가명');
  if (!params.surveyType?.trim()) missing.push('조사유형');
  if (!params.webAppUrl?.trim()) missing.push('시트 연동 URL');

  const ok = missing.length === 0;
  const message = ok
    ? '음성입력 시작'
    : `${missing[0]}을(를) 먼저 설정해주세요`;

  return { ok, missing, message };
}
