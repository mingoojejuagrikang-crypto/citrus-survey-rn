import { useCallback, useEffect } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../components/ActionButton';
import { Panel } from '../components/Panel';
import { colors } from '../constants/theme';
import { databaseService } from '../services/storage/DatabaseService';
import { useSurveyStore } from '../store/surveyStore';

export function RecordsScreen() {
  const records = useSurveyStore((state) => state.records);
  const setRecords = useSurveyStore((state) => state.setRecords);

  const refresh = useCallback(async () => {
    const rows = await databaseService.listRecentSamples();
    setRecords(rows);
  }, [setRecords]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <View style={styles.screen}>
      <Panel style={styles.header}>
        <Text style={styles.title}>기록</Text>
        <ActionButton label="새로고침" onPress={() => void refresh()} variant="secondary" />
      </Panel>
      <FlatList
        contentContainerStyle={styles.list}
        data={records}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Panel style={styles.item}>
            <Text style={styles.itemTitle}>
              {item.surveyDate} {item.farmName} / 나무 {item.treeNo} / 과실 {item.fruitNo}
            </Text>
            <Text style={styles.itemText}>
              {item.surveyType} | 라벨 {item.label || '-'} | 처리 {item.treatment || '-'}
            </Text>
            <Text style={styles.itemText}>
              {item.syncStatus === 1 ? '동기화 완료' : '동기화 대기'} | {item.updatedAt}
            </Text>
          </Panel>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.bg,
    flex: 1,
    gap: 12,
    padding: 12,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  list: {
    gap: 10,
    paddingBottom: 20,
  },
  item: {
    gap: 6,
  },
  itemTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  itemText: {
    color: colors.subtext,
  },
});
