import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useSurveyStore } from '../stores/SurveyStore';
import { COLORS } from '../utils/constants';
import { getAllSamples, getMeasurementsMap, Sample } from '../services/DatabaseService';

interface TreeProgress {
  treeNo: number;
  fruits: { fruitNo: number; completedFields: number; totalFields: number }[];
}

interface FarmProgress {
  farmName: string;
  trees: TreeProgress[];
  totalSamples: number;
  completedSamples: number;
}

const TARGET_FIELDS_GROWTH = ['횡경', '종경'];
const TARGET_FIELDS_QUALITY = ['횡경', '종경', '과중', '과피두께', '당도', '착색'];

export default function ProgressScreen() {
  const { session } = useSurveyStore();
  const [progress, setProgress] = useState<FarmProgress[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(session.surveyDate);

  const loadProgress = useCallback(async () => {
    setLoading(true);
    try {
      const samples = await getAllSamples();
      const filtered = samples.filter(s => s.survey_date === selectedDate);

      const targetFields = session.surveyType === '비대조사'
        ? TARGET_FIELDS_GROWTH : TARGET_FIELDS_QUALITY;

      // 농가별 그룹
      const farmMap: Record<string, Sample[]> = {};
      for (const s of filtered) {
        if (!farmMap[s.farm_name]) farmMap[s.farm_name] = [];
        farmMap[s.farm_name].push(s);
      }

      const farmProgressList: FarmProgress[] = [];
      for (const [farmName, farmSamples] of Object.entries(farmMap)) {
        // 나무별 그룹
        const treeMap: Record<number, Sample[]> = {};
        for (const s of farmSamples) {
          if (!treeMap[s.tree_no]) treeMap[s.tree_no] = [];
          treeMap[s.tree_no].push(s);
        }

        let completedSamples = 0;
        const trees: TreeProgress[] = [];

        for (const [treeNoStr, treeSamples] of Object.entries(treeMap)) {
          const treeNo = Number(treeNoStr);
          const fruits = [];
          for (const s of treeSamples) {
            const measurements = await getMeasurementsMap(s.sample_id);
            const completedFields = targetFields.filter(f => measurements[f] !== undefined).length;
            if (completedFields === targetFields.length) completedSamples++;
            fruits.push({ fruitNo: s.fruit_no, completedFields, totalFields: targetFields.length });
          }
          fruits.sort((a, b) => a.fruitNo - b.fruitNo);
          trees.push({ treeNo, fruits });
        }

        trees.sort((a, b) => a.treeNo - b.treeNo);
        farmProgressList.push({
          farmName,
          trees,
          totalSamples: farmSamples.length,
          completedSamples,
        });
      }

      farmProgressList.sort((a, b) => a.farmName.localeCompare(b.farmName));
      setProgress(farmProgressList);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, session.surveyType]);

  useEffect(() => { loadProgress(); }, [loadProgress]);

  function renderFruitDot(fruit: { fruitNo: number; completedFields: number; totalFields: number }) {
    const pct = fruit.completedFields / fruit.totalFields;
    let color = COLORS.error;
    if (pct >= 1) color = COLORS.success;
    else if (pct > 0) color = COLORS.warning;
    return (
      <View key={fruit.fruitNo} style={[styles.fruitDot, { backgroundColor: color }]}>
        <Text style={styles.fruitDotText}>{fruit.fruitNo}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.datePicker}>
        <Text style={styles.dateLabel}>조사일자</Text>
        <TouchableOpacity onPress={() => setSelectedDate(session.surveyDate)}>
          <Text style={styles.dateValue}>{selectedDate}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : progress.length === 0 ? (
        <Text style={styles.emptyText}>조사 데이터가 없습니다.</Text>
      ) : (
        progress.map(farm => {
          const pct = farm.totalSamples > 0
            ? farm.completedSamples / farm.totalSamples : 0;
          return (
            <View key={farm.farmName} style={styles.farmCard}>
              <View style={styles.farmHeader}>
                <Text style={styles.farmName}>{farm.farmName}</Text>
                <Text style={styles.farmStat}>
                  {farm.completedSamples}/{farm.totalSamples} 완료
                </Text>
              </View>
              {/* 전체 진행률 바 */}
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
              </View>
              {/* 나무별 진행 */}
              {farm.trees.map(tree => (
                <View key={tree.treeNo} style={styles.treeRow}>
                  <Text style={styles.treeLabel}>나무 {tree.treeNo}</Text>
                  <View style={styles.fruitRow}>
                    {tree.fruits.map(f => renderFruitDot(f))}
                    {tree.fruits.length === 0 && (
                      <Text style={styles.noFruit}>과실 없음</Text>
                    )}
                  </View>
                  <Text style={styles.treeStat}>
                    {tree.fruits.filter(f => f.completedFields === f.totalFields).length}/{tree.fruits.length}
                  </Text>
                </View>
              ))}
            </View>
          );
        })
      )}

      {/* 범례 */}
      <View style={styles.legend}>
        <LegendItem color={COLORS.success} label="완료" />
        <LegendItem color={COLORS.warning} label="진행중" />
        <LegendItem color={COLORS.error} label="미시작" />
      </View>
    </ScrollView>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 12, paddingBottom: 40 },
  datePicker: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  dateLabel: { color: COLORS.textMuted, fontSize: 13 },
  dateValue: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
  farmCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.border,
    gap: 8,
  },
  farmHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  farmName: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  farmStat: { color: COLORS.textMuted, fontSize: 13 },
  progressBar: {
    height: 6, backgroundColor: COLORS.card, borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: COLORS.success, borderRadius: 3 },
  treeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 4,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  treeLabel: { color: COLORS.textMuted, fontSize: 12, minWidth: 48 },
  fruitRow: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fruitDot: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  fruitDotText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  treeStat: { color: COLORS.textDim, fontSize: 11 },
  noFruit: { color: COLORS.textDim, fontSize: 11 },
  emptyText: { color: COLORS.textDim, textAlign: 'center', marginTop: 60, fontSize: 15 },
  legend: {
    flexDirection: 'row', justifyContent: 'center', gap: 20,
    marginTop: 8,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendLabel: { color: COLORS.textMuted, fontSize: 12 },
});
