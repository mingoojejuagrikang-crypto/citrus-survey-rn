import type { MeasurementItemName, ValueRange } from '../types/domain';

export function getRangeStatus(
  itemName: MeasurementItemName,
  value: number,
  ranges: ValueRange[]
): { isOutOfRange: boolean; warningMessage: string | null } {
  const range = ranges.find((entry) => entry.itemName === itemName);
  if (!range) {
    return { isOutOfRange: false, warningMessage: null };
  }

  const isOutOfRange = value < range.minValue || value > range.maxValue;
  return {
    isOutOfRange,
    warningMessage: isOutOfRange ? range.warningMessage : null,
  };
}

export function getDeltaSeverity(todayValue: number | null, historyValue: number | null) {
  if (todayValue === null || historyValue === null || historyValue === 0) {
    return { deltaPercent: null, severity: 'normal' as const };
  }

  const deltaPercent = Math.abs(((todayValue - historyValue) / historyValue) * 100);
  if (deltaPercent >= 30) {
    return { deltaPercent, severity: 'danger' as const };
  }
  if (deltaPercent >= 15) {
    return { deltaPercent, severity: 'warning' as const };
  }
  return { deltaPercent, severity: 'normal' as const };
}
