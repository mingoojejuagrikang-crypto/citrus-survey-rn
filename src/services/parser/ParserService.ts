import {
  COMMAND_ALIASES,
  CONTEXT_ALIASES,
  DISEASE_TERMS,
  ITEM_ALIASES,
  TEXT_ALIASES,
} from '../../constants/items';
import type {
  ContextFieldName,
  CustomTerm,
  ItemName,
  MeasurementItemName,
  ParsedIntent,
  TextFieldName,
} from '../../types/domain';
import { extractChoseong, getLevenshteinDistance, normalizeKoreanText } from '../../utils/korean';

type MatchResult<T extends ItemName> = {
  name: T;
  matchedAlias: string;
};

function findNumber(text: string): number | null {
  const matched = text.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return matched ? Number(matched[0]) : null;
}

function buildAliasMap(customTerms: CustomTerm[] = []) {
  const itemAliases = Object.entries(ITEM_ALIASES).flatMap(([name, aliases]) =>
    aliases.map((alias) => ({ name: name as MeasurementItemName, alias }))
  );
  const contextAliases = Object.entries(CONTEXT_ALIASES).flatMap(([name, aliases]) =>
    aliases.map((alias) => ({ name: name as ContextFieldName, alias }))
  );
  const textAliases = Object.entries(TEXT_ALIASES).flatMap(([name, aliases]) =>
    aliases.map((alias) => ({ name: name as TextFieldName, alias }))
  );
  const customAliases = customTerms.map((term) => ({
    name: term.canonical as ItemName,
    alias: term.alias,
  }));

  return [...itemAliases, ...contextAliases, ...textAliases, ...customAliases];
}

function findBestMatch<T extends ItemName>(
  source: string,
  candidates: Array<{ name: T; alias: string }>
): MatchResult<T> | null {
  const normalizedSource = normalizeKoreanText(source);

  const exact = candidates.find((entry) =>
    normalizedSource.includes(normalizeKoreanText(entry.alias))
  );
  if (exact) {
    return {
      name: exact.name,
      matchedAlias: exact.alias,
    };
  }

  const editDistanceMatch = candidates.find((entry) => {
    const alias = normalizeKoreanText(entry.alias);
    const samples = [normalizedSource, ...normalizedSource.split(/(?=\d)/g)];
    return samples.some((sample) => getLevenshteinDistance(sample.slice(0, alias.length), alias) <= 1);
  });
  if (editDistanceMatch) {
    return {
      name: editDistanceMatch.name,
      matchedAlias: editDistanceMatch.alias,
    };
  }

  const sourceChoseong = extractChoseong(normalizedSource);
  const choseongMatch = candidates.find(
    (entry) => sourceChoseong.includes(extractChoseong(normalizeKoreanText(entry.alias)))
  );
  if (choseongMatch) {
    return {
      name: choseongMatch.name,
      matchedAlias: choseongMatch.alias,
    };
  }

  return null;
}

function stripMatchedPrefix(source: string, matchedAlias: string): string {
  const escaped = matchedAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return source.replace(new RegExp(escaped, 'i'), '').trim();
}

export function parseSingle(rawText: string, customTerms: CustomTerm[] = []): ParsedIntent {
  const normalizedText = normalizeKoreanText(rawText);
  const action = COMMAND_ALIASES.수정.some((alias) => normalizedText.includes(normalizeKoreanText(alias)))
    ? 'update'
    : 'create';

  if (COMMAND_ALIASES.취소.some((alias) => normalizedText.includes(normalizeKoreanText(alias)))) {
    return { kind: 'command', commandName: '취소', rawText, normalizedText };
  }

  const aliasMap = buildAliasMap(customTerms);
  const measurementMatch = findBestMatch(
    rawText,
    aliasMap.filter((entry): entry is { name: MeasurementItemName; alias: string } =>
      Object.keys(ITEM_ALIASES).includes(entry.name)
    )
  );
  if (measurementMatch) {
    const value = findNumber(rawText);
    if (value !== null) {
      return {
        kind: 'measurement',
        itemName: measurementMatch.name,
        value,
        rawText,
        normalizedText,
        action,
      };
    }
  }

  const contextMatch = findBestMatch(
    rawText,
    aliasMap.filter((entry): entry is { name: ContextFieldName; alias: string } =>
      Object.keys(CONTEXT_ALIASES).includes(entry.name)
    )
  );
  if (contextMatch) {
    const remainder = stripMatchedPrefix(rawText, contextMatch.matchedAlias);
    const numericValue = findNumber(remainder);
    return {
      kind: 'context',
      fieldName: contextMatch.name,
      value:
        contextMatch.name === '나무' || contextMatch.name === '과실'
          ? numericValue ?? 0
          : remainder.replace(/^[:\s]+/, ''),
      rawText,
      normalizedText,
    };
  }

  const textMatch = findBestMatch(
    rawText,
    aliasMap.filter((entry): entry is { name: TextFieldName; alias: string } =>
      Object.keys(TEXT_ALIASES).includes(entry.name)
    )
  );
  if (textMatch) {
    const value = stripMatchedPrefix(rawText, textMatch.matchedAlias).replace(/^[:\s]+/, '');
    return {
      kind: 'text',
      fieldName: textMatch.name,
      value,
      rawText,
      normalizedText,
    };
  }

  const disease = DISEASE_TERMS.find((term) =>
    normalizedText.includes(normalizeKoreanText(term))
  );
  if (disease) {
    return {
      kind: 'text',
      fieldName: '병해충',
      value: disease,
      rawText,
      normalizedText,
    };
  }

  if (COMMAND_ALIASES.수정.some((alias) => normalizedText.includes(normalizeKoreanText(alias)))) {
    return { kind: 'command', commandName: '수정', rawText, normalizedText };
  }

  return {
    kind: 'unknown',
    rawText,
    normalizedText,
    reason: '일치하는 명령이나 조사 항목을 찾지 못했습니다.',
  };
}
