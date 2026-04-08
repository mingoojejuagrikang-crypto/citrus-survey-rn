import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, Alert, ActivityIndicator,
} from 'react-native';
import { useSurveyStore } from '../stores/SurveyStore';
import { COLORS } from '../utils/constants';
import { getAllSamples, getMeasurementsMap, Sample } from '../services/DatabaseService';
import { runSync, getUnsyncedCount } from '../services/SyncService';
import { exportToCSV } from '../utils/exportCSV';

type FilterType = '오늘' | '전체';

interface RowData extends Sample {
  measurements: Record<string, number>;
}

export default function DataScreen() {
  const { session, unsyncedCount, setUnsyncedCount } = useSurveyStore();
  const [filter, setFilter] = useState<FilterType>('오늘');
  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const samples = await getAllSamples();
      const filtered = filter === '오늘'
        ? samples.filter(s => s.survey_date === session.surveyDate)
        : samples;

      const withMeasurements: RowData[] = await Promise.all(
        filtered.map(async s => ({
          ...s,
          measurements: await getMeasurementsMap(s.sample_id),
        }))
      );
      setRows(withMeasurements);

      const count = await getUnsyncedCount();
      setUnsyncedCount(count);
    } finally {
      setLoading(false);
    }
  }, [filter, session.surveyDate, setUnsyncedCount]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSync() {
    setSyncing(true);
    try {
      const count = await runSync();
      if (count > 0) {
        Alert.alert('동기화 완료', `${count}건 전송 완료`);
      } else {
        Alert.alert('동기화', '전송할 데이터가 없거나 네트워크를 확인하세요.');
      }
      await loadData();
    } catch (err) {
      Alert.alert('오류', String(err));
    } finally {
      setSyncing(false);
    }
  }

  async function handleExportCSV() {
    try {
      const samples = await getAllSamples();
      const csvRows = await Promise.all(
        samples.map(async s => ({
          surveyDate: s.survey_date,
          surveyType: s.survey_type,
          farmName: s.farm_name,
          label: s.label,
          treatment: s.treatment,
          treeNo: s.tree_no,
          fruitNo: s.fruit_no,
          measurements: await getMeasurementsMap(s.sample_id),
          memo: s.memo,
          observer: s.observer,
          syncStatus: s.sync_status,
          createdAt: s.created_at,
        }))
      );
      await exportToCSV(csvRows);
    } catch (err) {
      Alert.alert('내보내기 오류', String(err));
    }
  }

  function renderRow({ item }: { item: RowData }) {
    const measureKeys = Object.keys(item.measurements).filter(k => k !== '비고');
    return (
      <View style={styles.dataRow}>
        <View style={styles.dataRowHeader}>
          <Text style={styles.dataRowTitle}>
            {item.farm_name} · 나무{item.tree_no} · 과실{item.fruit_no}
          </Text>
          <View style={[styles.syncBadge, item.sync_status === 1 ? styles.syncDone : styles.syncPending]}>
            <Text style={styles.syncBadgeText}>
              {item.sync_status === 1 ? '전송완료' : '미전송'}
            </Text>
          </View>
        </View>
        <Text style={styles.dataRowMeta}>
          {item.survey_type} · {item.label} · {item.treatment}
        </Text>
        <View style={styles.measureRow}>
          {measureKeys.map(k => (
            <View key={k} style={styles.measureItem}>
              <Text style={styles.measureKey}>{k}</Text>
              <Text style={styles.measureVal}>{item.measurements[k]}</Text>
            </View>
          ))}
        </View>
        {item.memo ? (
          <Text style={styles.memo}>비고: {item.memo}</Text>
        ) : null}
        <Text style={styles.dataRowDate}>{item.created_at.slice(0, 16)}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 상단 바 */}
      <View style={styles.topBar}>
        <View style={styles.filterRow}>
          {(['오늘', '전체'] as FilterType[]).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterBtnText, filter === f && { color: '#fff' }]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.actionRow}>
          {unsyncedCount > 0 && (
            <View style={styles.unsyncedBadge}>
              <Text style={styles.unsyncedText}>미전송 {unsyncedCount}건</Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.actionBtn, syncing && { opacity: 0.6 }]}
            onPress={handleSync}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Text style={styles.actionBtnText}>동기화</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleExportCSV}>
            <Text style={styles.actionBtnText}>CSV</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={item => item.sample_id}
          renderItem={renderRow}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>데이터가 없습니다.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  topBar: {
    backgroundColor: COLORS.surface,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterBtn: {
    paddingVertical: 6, paddingHorizontal: 16,
    borderRadius: 8, backgroundColor: COLORS.card,
    borderWidth: 1, borderColor: COLORS.border,
  },
  filterBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterBtnText: { color: COLORS.textMuted, fontSize: 13 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unsyncedBadge: {
    backgroundColor: COLORS.warning + '33',
    borderRadius: 6,
    paddingVertical: 4, paddingHorizontal: 8,
    borderWidth: 1, borderColor: COLORS.warning,
  },
  unsyncedText: { color: COLORS.warning, fontSize: 12, fontWeight: '600' },
  actionBtn: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    paddingVertical: 6, paddingHorizontal: 14,
    borderWidth: 1, borderColor: COLORS.border,
    minWidth: 60, alignItems: 'center',
  },
  actionBtnText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  listContent: { padding: 12, gap: 8, paddingBottom: 40 },
  dataRow: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1, borderColor: COLORS.border,
    gap: 4,
  },
  dataRowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dataRowTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  syncBadge: { borderRadius: 4, paddingVertical: 2, paddingHorizontal: 6 },
  syncDone: { backgroundColor: COLORS.success + '22' },
  syncPending: { backgroundColor: COLORS.warning + '22' },
  syncBadgeText: { fontSize: 10, fontWeight: '600', color: COLORS.textMuted },
  dataRowMeta: { color: COLORS.textDim, fontSize: 11 },
  measureRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  measureItem: {
    backgroundColor: COLORS.card,
    borderRadius: 6,
    paddingVertical: 3, paddingHorizontal: 8,
    alignItems: 'center',
  },
  measureKey: { color: COLORS.textDim, fontSize: 10 },
  measureVal: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  memo: { color: COLORS.textMuted, fontSize: 11, fontStyle: 'italic' },
  dataRowDate: { color: COLORS.textDim, fontSize: 10, marginTop: 2 },
  emptyText: { color: COLORS.textDim, textAlign: 'center', marginTop: 60, fontSize: 15 },
});
