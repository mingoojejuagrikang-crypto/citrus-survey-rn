import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/theme';
import type { ComparisonRow } from '../types/domain';

type Props = {
  rows: ComparisonRow[];
};

export function ComparisonTable({ rows }: Props) {
  return (
    <View style={styles.table}>
      <View style={styles.header}>
        <Text style={[styles.cell, styles.headerText]}>항목</Text>
        <Text style={[styles.cell, styles.headerText]}>오늘</Text>
        <Text style={[styles.cell, styles.headerText]}>과거</Text>
      </View>
      {rows.map((row) => (
        <View
          key={row.itemName}
          style={[
            styles.row,
            row.severity === 'warning' ? styles.warning : null,
            row.severity === 'danger' ? styles.danger : null,
          ]}
        >
          <Text style={styles.cell}>{row.itemName}</Text>
          <Text style={[styles.cell, row.isOutOfRange ? styles.outOfRange : null]}>
            {row.todayValue ?? '-'}
          </Text>
          <Text style={styles.cell}>{row.historyValue ?? '-'}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: 4,
  },
  headerText: {
    color: colors.subtext,
    fontSize: 12,
    fontWeight: '700',
  },
  row: {
    backgroundColor: colors.panelMuted,
    borderRadius: 14,
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  cell: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
  },
  warning: {
    borderColor: colors.warning,
    borderWidth: 1,
  },
  danger: {
    borderColor: colors.danger,
    borderWidth: 1,
  },
  outOfRange: {
    color: colors.warning,
    fontWeight: '700',
  },
});
