/**
 * 연속 발화 스트림 파서 (v3)
 *
 * 입력: "나무2 과실3 횡경22.5 종경35.1 나무2 과실5 횡경35.1 종경22.4"
 * 출력: ParsedToken[] — 순서대로 처리할 명령 목록
 */
import { FIELD_ALIASES, FARMER_ALIASES } from '../utils/constants';

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

// ─── 숫자 추출 ────────────────────────────────────────────────────────────────
function extractLeadingNumber(str: string): number | null {
  const m = str.match(/^[\d.]+/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return isNaN(n) ? null : n;
}

// ─── 토큰 타입 ────────────────────────────────────────────────────────────────
export type ParsedToken =
  | { type: 'measurement'; field: string; value: number; raw: string; outOfRange?: boolean }
  | { type: 'context'; key: 'treeNo' | 'fruitNo' | 'farmName' | 'label' | 'treatment'; value: string | number; raw: string }
  | { type: 'correction'; raw: string }
  | { type: 'cancel'; raw: string }
  | { type: 'memo'; text: string; raw: string }
  | { type: 'unknown'; raw: string };

// ─── 메인: 연속 발화 스트림 → 토큰 배열 ─────────────────────────────────────
export function parseStream(
  text: string,
  extraAliases: Record<string, string> = {}
): ParsedToken[] {
  // 1. 붙여 쓴 경우 분리: "횡경22.5" → "횡경 22.5", "나무2" → "나무 2"
  const separated = text
    .replace(/([가-힣]+)([\d.]+)/g, '$1 $2')   // 한글+숫자 분리
    .replace(/([\d.]+)([가-힣]+)/g, '$1 $2');   // 숫자+한글 분리

  const rawTokens = separated.trim().split(/\s+/).filter(Boolean);
  const tokens = rawTokens;
  const result: ParsedToken[] = [];
  let i = 0;

  while (i < tokens.length) {
    const tok = tokens[i];
    const tokLower = tok.toLowerCase();

    // ── 수정/정정 ────────────────────────────────
    if (tokLower === '수정' || tokLower === '정정') {
      result.push({ type: 'correction', raw: tok });
      i++;
      continue;
    }

    // ── 취소 ────────────────────────────────────
    if (tokLower === '취소') {
      result.push({ type: 'cancel', raw: tok });
      i++;
      continue;
    }

    // ── 비고 ────────────────────────────────────
    if (tokLower === '비고' || tokLower === '메모') {
      const textParts: string[] = [];
      i++;
      while (i < tokens.length) {
        const next = tokens[i];
        const m = fuzzyMatchField(next, extraAliases);
        if (m && ['나무','과실','농가','라벨','처리','수정','취소'].includes(m.field)) break;
        const num = extractLeadingNumber(next);
        if (num !== null && i < tokens.length - 1) break; // 숫자가 측정값 같으면 비고 종료
        textParts.push(next);
        i++;
      }
      result.push({ type: 'memo', text: textParts.join(' '), raw: tok + ' ' + textParts.join(' ') });
      continue;
    }

    // ── 필드 매칭 시도 ───────────────────────────
    const matched = fuzzyMatchField(tokLower, extraAliases);
    if (matched) {
      const field = matched.field;

      // 컨텍스트: 나무
      if (field === '나무') {
        const nextNum = i + 1 < tokens.length ? extractLeadingNumber(tokens[i + 1]) : null;
        if (nextNum !== null) {
          result.push({ type: 'context', key: 'treeNo', value: Math.round(nextNum), raw: `${tok} ${tokens[i+1]}` });
          i += 2;
        } else { i++; }
        continue;
      }

      // 컨텍스트: 과실
      if (field === '과실') {
        const nextNum = i + 1 < tokens.length ? extractLeadingNumber(tokens[i + 1]) : null;
        if (nextNum !== null) {
          result.push({ type: 'context', key: 'fruitNo', value: Math.round(nextNum), raw: `${tok} ${tokens[i+1]}` });
          i += 2;
        } else { i++; }
        continue;
      }

      // 컨텍스트: 농가
      if (field === '농가') {
        const nextTok = i + 1 < tokens.length ? tokens[i + 1] : null;
        if (nextTok && extractLeadingNumber(nextTok) === null) {
          const farmName = FARMER_ALIASES[nextTok] || nextTok;
          result.push({ type: 'context', key: 'farmName', value: farmName, raw: `${tok} ${nextTok}` });
          i += 2;
        } else { i++; }
        continue;
      }

      // 컨텍스트: 라벨
      if (field === '라벨') {
        const nextTok = i + 1 < tokens.length ? tokens[i + 1] : null;
        if (nextTok) {
          result.push({ type: 'context', key: 'label', value: nextTok, raw: `${tok} ${nextTok}` });
          i += 2;
        } else { i++; }
        continue;
      }

      // 컨텍스트: 처리
      if (field === '처리') {
        const nextTok = i + 1 < tokens.length ? tokens[i + 1] : null;
        if (nextTok && extractLeadingNumber(nextTok) === null) {
          result.push({ type: 'context', key: 'treatment', value: nextTok, raw: `${tok} ${nextTok}` });
          i += 2;
        } else { i++; }
        continue;
      }

      // 측정값
      if (field !== '수정' && field !== '취소' && field !== '비고') {
        const nextNum = i + 1 < tokens.length ? extractLeadingNumber(tokens[i + 1]) : null;
        if (nextNum !== null) {
          result.push({ type: 'measurement', field, value: nextNum, raw: `${tok} ${tokens[i+1]}` });
          i += 2;
        } else {
          // 숫자 없이 필드만 인식된 경우 (다음에 올 수 있음)
          i++;
        }
        continue;
      }
    }

    // ── 순수 숫자 → 직전 측정 필드에 값 추가 ─────
    const numVal = extractLeadingNumber(tok);
    if (numVal !== null) {
      // 바로 이전 토큰이 필드였으면 측정값으로 사용 (이미 처리됨)
      // 단독 숫자는 unknown
      result.push({ type: 'unknown', raw: tok });
      i++;
      continue;
    }

    result.push({ type: 'unknown', raw: tok });
    i++;
  }

  return result;
}

// ─── 5개 후보 중 최적 선택 ───────────────────────────────────────────────────
export function parseBestAlternative(
  alternatives: string[],
  extraAliases: Record<string, string> = {}
): ParsedToken[] {
  if (alternatives.length === 0) return [];

  // 각 후보를 파싱하여 성공 토큰 수가 가장 많은 것 선택
  let bestTokens: ParsedToken[] = [];
  let bestScore = -1;

  for (const alt of alternatives) {
    const tokens = parseStream(alt, extraAliases);
    const score = tokens.filter(t => t.type !== 'unknown').length * 3
      + tokens.filter(t => t.type === 'measurement').length * 2;
    if (score > bestScore) {
      bestScore = score;
      bestTokens = tokens;
    }
  }

  return bestTokens.length > 0 ? bestTokens : parseStream(alternatives[0], extraAliases);
}
