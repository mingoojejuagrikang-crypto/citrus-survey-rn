import { parseSingle } from '../services/parser/ParserService';
import {
  flattenHistoryResponse,
  normalizeHistoryRows,
} from '../services/history/historyParsers';
import { parseSyncHttpResponse } from '../services/sync/syncParsers';
import { getDeltaSeverity, getRangeStatus } from '../utils/range';
import { resolveUndoValue } from '../utils/undo';

describe('ParserService', () => {
  it('parses exact measurement commands', () => {
    const result = parseSingle('횡경 52.3');
    expect(result).toMatchObject({
      kind: 'measurement',
      itemName: '횡경',
      value: 52.3,
    });
  });

  it('parses values with commas removed', () => {
    const result = parseSingle('과중 1,234.5');
    expect(result).toMatchObject({
      kind: 'measurement',
      itemName: '과중',
      value: 1234.5,
    });
  });

  it('parses near typo with edit distance', () => {
    const result = parseSingle('당두 11.8');
    expect(result).toMatchObject({
      kind: 'measurement',
      itemName: '당도',
      value: 11.8,
    });
  });

  it('parses choseong-like input', () => {
    const result = parseSingle('ㄷㄷ 12.1');
    expect(result.kind).toBe('measurement');
  });

  it('parses disease direct speech as text field', () => {
    const result = parseSingle('응애');
    expect(result).toMatchObject({
      kind: 'text',
      fieldName: '병해충',
      value: '응애',
    });
  });

  it('parses undo command', () => {
    const result = parseSingle('취소');
    expect(result).toMatchObject({
      kind: 'command',
      commandName: '취소',
    });
  });
});

describe('range utils', () => {
  it('flags out-of-range value', () => {
    const rangeStatus = getRangeStatus('횡경', 150, [
      { itemName: '횡경', minValue: 20, maxValue: 100, warningMessage: '확인' },
    ]);
    expect(rangeStatus.isOutOfRange).toBe(true);
  });

  it('calculates severity for history delta', () => {
    const result = getDeltaSeverity(130, 100);
    expect(result.severity).toBe('danger');
  });
});

describe('undo utils', () => {
  it('deletes current when there is no previous value', () => {
    const result = resolveUndoValue(null, null);
    expect(result.deleteCurrent).toBe(true);
  });

  it('restores previous numeric value when available', () => {
    const result = resolveUndoValue(10.5, null);
    expect(result).toMatchObject({
      deleteCurrent: false,
      numericValue: 10.5,
    });
  });
});

describe('history parsers', () => {
  it('flattens grouped history response', () => {
    const rows = flattenHistoryResponse({
      status: 'ok',
      data: {
        비대조사: [{ 조사일자: '2025-08-05', 농가명: '이원창', 라벨: 'A', 처리: '시험', 조사나무: 1, 조사과실: 1, 횡경: 38.7, 종경: 34.9 }],
        품질조사: [{ 조사일자: '2025-08-06', 농가명: '이원창', 라벨: 'A', 처리: '시험', 조사나무: 1, 조사과실: 1, 당도: 11.2 }],
      },
    });
    expect(rows).toHaveLength(2);
  });

  it('normalizes wide history rows into item rows', () => {
    const rows = normalizeHistoryRows(
      [{ 조사일자: '2025-08-05', 농가명: '이원창', 라벨: 'A', 처리: '시험', 조사나무: 1, 조사과실: 1, 횡경: 38.7, 종경: 34.9 }],
      '이원창'
    );
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ itemName: '횡경', value: 38.7 }),
        expect.objectContaining({ itemName: '종경', value: 34.9 }),
      ])
    );
  });
});

describe('sync parsers', () => {
  it('accepts successful json sync response', () => {
    const parsed = parseSyncHttpResponse(200, 'application/json', '{"success":true}');
    expect(parsed.ok).toBe(true);
  });

  it('rejects html sync response', () => {
    const parsed = parseSyncHttpResponse(200, 'text/html', '<html>error</html>');
    expect(parsed.ok).toBe(false);
  });
});
