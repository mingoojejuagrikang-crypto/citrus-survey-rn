import { FIELD_ALIASES, FARMER_ALIASES } from '../utils/constants';

// 초성 추출
const CHOSEONG = [
  'ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ',
];

function getChoseong(str: string): string {
  return str.split('').map(c => {
    const code = c.charCodeAt(0) - 0xAC00;
    if (code < 0 || code > 11171) return c;
    return CHOSEONG[Math.floor(code / 21 / 28)];
  }).join('');
}

// 편집거리 (Levenshtein)
function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

// 퍼지 매칭: 별칭사전 → 편집거리 → 초성비교
function fuzzyMatchField(input: string): { field: string; score: number } | null {
  const normalized = input.trim().toLowerCase();

  // 1. 정확 매칭
  if (FIELD_ALIASES[normalized]) {
    return { field: FIELD_ALIASES[normalized], score: 3 };
  }
  if (FIELD_ALIASES[input]) {
    return { field: FIELD_ALIASES[input], score: 3 };
  }

  // 2. 편집거리 1 이내
  for (const [alias, field] of Object.entries(FIELD_ALIASES)) {
    if (editDistance(normalized, alias) <= 1) {
      return { field, score: 2 };
    }
  }

  // 3. 초성 비교
  const inputChoseong = getChoseong(normalized);
  for (const [alias, field] of Object.entries(FIELD_ALIASES)) {
    if (getChoseong(alias) === inputChoseong && inputChoseong.length >= 2) {
      return { field, score: 1 };
    }
  }

  return null;
}

// 숫자 추출 (한국어 숫자 포함)
function extractNumber(str: string): number | null {
  // 한국어 소수점 표현: "이십이점오" 같은 것은 무시하고 아라비아 숫자 추출
  const match = str.match(/[\d.]+/);
  if (match) {
    const num = parseFloat(match[0]);
    return isNaN(num) ? null : num;
  }
  return null;
}

export interface ParsedCommand {
  type: 'measurement' | 'context' | 'correction' | 'memo' | 'unknown';
  field?: string;        // 측정 항목명
  value?: number;        // 측정값
  contextKey?: string;   // 'farmName' | 'label' | 'treatment' | 'treeNo' | 'fruitNo'
  contextValue?: string | number;
  rawText: string;
  score: number;         // 매칭 신뢰도 (1~3)
}

// 컨텍스트 패턴
const CONTEXT_PATTERNS: { pattern: RegExp; key: string; isNumber?: boolean }[] = [
  { pattern: /^(농가|농가명|농가이름)\s+(.+)$/, key: 'farmName' },
  { pattern: /^(라벨|레이블)\s+(.+)$/, key: 'label' },
  { pattern: /^(처리|처리구|처리군)\s+(.+)$/, key: 'treatment' },
  { pattern: /^(나무|조사나무|나무번호)\s+([\d]+)$/, key: 'treeNo', isNumber: true },
  { pattern: /^(과실|조사과실|과일|과실번호|과번)\s+([\d]+)$/, key: 'fruitNo', isNumber: true },
];

function parseText(text: string): ParsedCommand {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // 수정/정정
  if (lower === '수정' || lower === '정정') {
    return { type: 'correction', rawText: trimmed, score: 3 };
  }

  // 컨텍스트 변경
  for (const { pattern, key, isNumber } of CONTEXT_PATTERNS) {
    const m = trimmed.match(pattern);
    if (m) {
      const val = m[2].trim();
      // 농가명 퍼지매칭
      if (key === 'farmName') {
        const resolved = FARMER_ALIASES[val] || val;
        return { type: 'context', contextKey: key, contextValue: resolved, rawText: trimmed, score: 3 };
      }
      const contextValue = isNumber ? parseInt(val, 10) : val;
      return { type: 'context', contextKey: key, contextValue, rawText: trimmed, score: 3 };
    }
  }

  // 비고
  const memoMatch = trimmed.match(/^(비고|메모|참고|특이|특이사항)\s+(.+)$/);
  if (memoMatch) {
    return { type: 'memo', value: undefined, rawText: trimmed, field: memoMatch[2], score: 3 };
  }

  // 측정값: "항목 숫자" 형식
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    // 마지막 토큰이 숫자인지 확인
    const lastPart = parts[parts.length - 1];
    const num = extractNumber(lastPart);
    if (num !== null) {
      const fieldPart = parts.slice(0, -1).join('');
      const matched = fuzzyMatchField(fieldPart);
      if (matched) {
        return {
          type: 'measurement',
          field: matched.field,
          value: num,
          rawText: trimmed,
          score: matched.score,
        };
      }
      // 알 수 없는 항목도 "항목명 숫자" 형식이면 저장
      return {
        type: 'measurement',
        field: fieldPart,
        value: num,
        rawText: trimmed,
        score: 0,
      };
    }
  }

  // 단일 토큰 퍼지매칭 (숫자 없음)
  if (parts.length === 1) {
    const matched = fuzzyMatchField(parts[0]);
    if (matched) {
      return { type: 'measurement', field: matched.field, rawText: trimmed, score: matched.score };
    }
  }

  return { type: 'unknown', rawText: trimmed, score: 0 };
}

// 5개 후보에서 최적 선택
export function parseBestAlternative(alternatives: string[]): ParsedCommand {
  const parsed = alternatives.map(a => parseText(a));

  // 우선순위: type score (measurement>context>memo>correction>unknown), 매칭 score 높은 것
  const typeScore = (cmd: ParsedCommand): number => {
    switch (cmd.type) {
      case 'correction': return 10;
      case 'context': return 8;
      case 'memo': return 7;
      case 'measurement': return cmd.score > 0 ? 6 + cmd.score : 3;
      default: return 0;
    }
  };

  parsed.sort((a, b) => typeScore(b) - typeScore(a));
  return parsed[0];
}

export function parseSingle(text: string): ParsedCommand {
  return parseText(text);
}
