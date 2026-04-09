/**
 * 음성 파서 (v3)
 *
 * 입력 방식: 한 번에 하나씩 ("횡경 38.7", "과실 2", "병해충 궤양병")
 * 출력: ParsedToken — 단일 명령
 */
import { FIELD_ALIASES, FARMER_ALIASES, FIELD_VALUE_TYPES, koreanToNumber } from '../utils/constants';

// ─── 초성 추출 ────────────────────────────────────────────────────────────────
const CHOSEONG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

function getChoseong(str: string): string {
  return str.split('').map(c => {
    const code = c.charCodeAt(0) - 0xAC00;
    if (code < 0 || code > 11171) return c;
    return CHOSEONG[Math.floor(code / 21 / 28)];
  }).join('');
}

// ─── 편집거리 ─────────────────────────────────────────────────────────────────
function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

// ─── 퍼지 필드 매칭 ───────────────────────────────────────────────────────────
export function fuzzyMatchField(
  input: string,
  extraAliases: Record<string, string> = {}
): { field: string; score: number } | null {
  const lower = input.trim().toLowerCase();
  const allAliases = { ...FIELD_ALIASES, ...extraAliases };

  // 1. 정확 매칭
  if (allAliases[lower]) return { field: allAliases[lower], score: 3 };
  if (allAliases[input]) return { field: allAliases[input], score: 3 };

  // 2. 편집거리 1 이내
  for (const [alias, field] of Object.entries(allAliases)) {
    if (editDistance(lower, alias) <= 1) return { field, score: 2 };
  }

  // 3. 초성 비교
  const inputCs = getChoseong(lower);
  for (const [alias, field] of Object.entries(allAliases)) {
    if (inputCs === getChoseong(alias) && inputCs.length >= 2)
      return { field, score: 1 };
  }

  return null;
}

// ─── 숫자 추출 (한글 포함) ────────────────────────────────────────────────────
function extractLeadingNumber(str: string): number | null {
  // 아라비아 숫자 우선
  const m = str.match(/^[\d.]+/);
  if (m) {
    const n = parseFloat(m[0]);
    return isNaN(n) ? null : n;
  }
  // 한글 숫자 시도
  return koreanToNumber(str);
}

// ─── 토큰 타입 ────────────────────────────────────────────────────────────────
export type ParsedToken =
  | { type: 'measurement'; field: string; value: number; raw: string }
  | { type: 'text_field'; field: string; value: string; raw: string }   // 병해충, 비고
  | { type: 'context'; key: 'treeNo' | 'fruitNo' | 'farmName' | 'label' | 'treatment'; value: string | number; raw: string }
  | { type: 'correction'; raw: string }
  | { type: 'cancel'; raw: string }
  | { type: 'unknown'; raw: string };

// ─── 단일 발화 파싱 (한 번에 하나씩 입력 방식) ───────────────────────────────
export function parseSingle(
  text: string,
  extraAliases: Record<string, string> = {}
): ParsedToken {
  // 붙여 쓴 경우 분리: "횡경22.5" → "횡경 22.5", "나무2" → "나무 2"
  const separated = text.trim()
    .replace(/([가-힣]+)([\d.]+)/g, '$1 $2')
    .replace(/([\d.]+)([가-힣]+)/g, '$1 $2');

  const parts = separated.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { type: 'unknown', raw: text };

  const first = parts[0];
  const firstLower = first.toLowerCase();

  // ── 수정/취소 ────────────────────────────────────────────────────────────
  if (firstLower === '수정' || firstLower === '정정') return { type: 'correction', raw: text };
  if (firstLower === '취소') return { type: 'cancel', raw: text };

  // ── 필드 매칭 ─────────────────────────────────────────────────────────────
  const matched = fuzzyMatchField(firstLower, extraAliases);
  if (!matched) return { type: 'unknown', raw: text };

  const field = matched.field;
  const restParts = parts.slice(1);
  const restText = restParts.join(' ');

  // 컨텍스트: 나무
  if (field === '나무') {
    const num = restParts.length > 0 ? extractLeadingNumber(restParts[0]) : null;
    if (num !== null) return { type: 'context', key: 'treeNo', value: Math.round(num), raw: text };
    return { type: 'unknown', raw: text };
  }

  // 컨텍스트: 과실
  if (field === '과실') {
    const num = restParts.length > 0 ? extractLeadingNumber(restParts[0]) : null;
    if (num !== null) return { type: 'context', key: 'fruitNo', value: Math.round(num), raw: text };
    return { type: 'unknown', raw: text };
  }

  // 컨텍스트: 농가
  if (field === '농가') {
    if (restText) {
      const farmName = FARMER_ALIASES[restText] || restText;
      return { type: 'context', key: 'farmName', value: farmName, raw: text };
    }
    return { type: 'unknown', raw: text };
  }

  // 컨텍스트: 라벨
  if (field === '라벨') {
    if (restText) return { type: 'context', key: 'label', value: restText, raw: text };
    return { type: 'unknown', raw: text };
  }

  // 컨텍스트: 처리
  if (field === '처리') {
    if (restText) return { type: 'context', key: 'treatment', value: restText, raw: text };
    return { type: 'unknown', raw: text };
  }

  // 텍스트 타입 항목: 비고, 병해충, 또는 병해충 이름 직접 매칭
  const valueType = FIELD_VALUE_TYPES[field];
  if (field === '비고' || field === '병해충') {
    if (restText) return { type: 'text_field', field, value: restText, raw: text };
    return { type: 'unknown', raw: text };
  }

  // 병해충 이름이 직접 매칭된 경우 (예: "귤응애" 단독 발화 → 병해충=귤응애)
  if (isPestOrDisease(field)) {
    return { type: 'text_field', field: '병해충', value: field, raw: text };
  }

  // 숫자 타입 측정값
  if (valueType === 'number' || !valueType) {
    if (restParts.length > 0) {
      const num = extractLeadingNumber(restParts[0]);
      if (num !== null) return { type: 'measurement', field, value: num, raw: text };
      // 한글 숫자 변환 시도
      const korNum = koreanToNumber(restText);
      if (korNum !== null) return { type: 'measurement', field, value: korNum, raw: text };
    }
  }

  return { type: 'unknown', raw: text };
}

// 병해충 이름 여부 판단
const PEST_DISEASE_NAMES = new Set([
  '검은점무늬병','더뎅이병','탄저병','잿빛곰팡이병','궤양병',
  '황반병','누른무늬병','뿌리마름병','줄기마름병','역병','저장병',
  '귤응애','귤굴나방','귤녹응애','귤가루이','꽃노랑총채벌레',
  '깍지벌레','진딧물','차응애','말매미','노린재',
]);

function isPestOrDisease(name: string): boolean {
  return PEST_DISEASE_NAMES.has(name);
}

// ─── 5개 후보 중 최적 선택 ───────────────────────────────────────────────────
export function parseBestAlternative(
  alternatives: string[],
  extraAliases: Record<string, string> = {}
): ParsedToken {
  if (alternatives.length === 0) return { type: 'unknown', raw: '' };

  const scored = alternatives.map(alt => {
    const token = parseSingle(alt, extraAliases);
    const score =
      token.type === 'measurement' ? 3 :
      token.type === 'text_field'  ? 3 :
      token.type === 'context'     ? 2 :
      token.type === 'correction'  ? 2 :
      token.type === 'cancel'      ? 2 : 0;
    return { token, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].token;
}
