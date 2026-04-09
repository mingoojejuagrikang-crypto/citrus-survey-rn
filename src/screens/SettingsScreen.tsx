import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../components/ActionButton';
import { Panel } from '../components/Panel';
import { colors } from '../constants/theme';
import { MEASUREMENT_ITEM_LABELS } from '../constants/items';
import { historyService } from '../services/history/HistoryService';
import { databaseService } from '../services/storage/DatabaseService';
import { useSessionStore } from '../store/sessionStore';
import { useSettingsStore } from '../store/settingsStore';
import type { MeasurementItemName, SurveyType, ValueRange } from '../types/domain';

export function SettingsScreen() {
  const observer = useSessionStore((state) => state.observer);
  const setObserver = useSessionStore((state) => state.setObserver);
  const farmName = useSessionStore((state) => state.farmName);
  const webAppUrl = useSettingsStore((state) => state.webAppUrl);
  const farms = useSettingsStore((state) => state.farms);
  const enabledItems = useSettingsStore((state) => state.enabledItems);
  const valueRanges = useSettingsStore((state) => state.valueRanges);
  const customTerms = useSettingsStore((state) => state.customTerms);
  const setWebAppUrl = useSettingsStore((state) => state.setWebAppUrl);
  const setFarms = useSettingsStore((state) => state.setFarms);
  const setEnabledItems = useSettingsStore((state) => state.setEnabledItems);
  const setValueRanges = useSettingsStore((state) => state.setValueRanges);
  const setCustomTerms = useSettingsStore((state) => state.setCustomTerms);

  const [observerInput, setObserverInput] = useState(observer);
  const [webAppUrlInput, setWebAppUrlInput] = useState(webAppUrl);
  const [farmsInput, setFarmsInput] = useState(farms.join(', '));
  const [customAlias, setCustomAlias] = useState('');
  const [customCanonical, setCustomCanonical] = useState<MeasurementItemName>('횡경');

  const toggleItem = useCallback(
    (surveyType: SurveyType, itemName: MeasurementItemName) => {
      const current = enabledItems[surveyType];
      const nextItems = current.includes(itemName)
        ? current.filter((entry) => entry !== itemName)
        : [...current, itemName];
      const next = {
        ...enabledItems,
        [surveyType]: nextItems,
      };
      setEnabledItems(next);
      void databaseService.setConfigValue('enabled_items', JSON.stringify(next));
    },
    [enabledItems, setEnabledItems]
  );

  const saveBasics = useCallback(async () => {
    const nextObserver = observerInput.trim();
    const nextWebAppUrl = webAppUrlInput.trim();
    const nextFarms = farmsInput
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);

    setObserver(nextObserver);
    setWebAppUrl(nextWebAppUrl);
    setFarms(nextFarms);

    await Promise.all([
      databaseService.setConfigValue('observer', nextObserver),
      databaseService.setConfigValue('webAppUrl', nextWebAppUrl),
      databaseService.setConfigValue('farms', JSON.stringify(nextFarms)),
    ]);

    Alert.alert('저장 완료', '기본 설정을 저장했습니다.');
  }, [farmsInput, observerInput, setFarms, setObserver, setWebAppUrl, webAppUrlInput]);

  const saveRange = useCallback(
    async (itemName: MeasurementItemName, next: Partial<ValueRange>) => {
      const current = valueRanges.find((range) => range.itemName === itemName);
      if (!current) {
        return;
      }
      const merged = { ...current, ...next };
      await databaseService.upsertValueRange(merged);
      const updated = await databaseService.getValueRanges();
      setValueRanges(updated);
    },
    [setValueRanges, valueRanges]
  );

  const addCustomTerm = useCallback(async () => {
    if (!customAlias.trim()) {
      return;
    }
    await databaseService.addCustomTerm({
      alias: customAlias.trim(),
      canonical: customCanonical,
      category: 'item',
    });
    setCustomTerms(await databaseService.listCustomTerms());
    setCustomAlias('');
  }, [customAlias, customCanonical, setCustomTerms]);

  const restoreFromSheet = useCallback(async () => {
    try {
      const count = await historyService.restore(new Date().getFullYear() - 1, farmName, webAppUrl);
      Alert.alert('복구 완료', `${count}건의 과거값을 가져왔습니다.`);
    } catch (error) {
      Alert.alert('복구 실패', error instanceof Error ? error.message : '복구 중 오류');
    }
  }, [farmName, webAppUrl]);

  const rangeRows = useMemo(() => valueRanges, [valueRanges]);

  return (
    <FlatList
      contentContainerStyle={styles.screen}
      data={rangeRows}
      keyExtractor={(item) => item.itemName}
      ListHeaderComponent={
        <>
          <Panel style={styles.section}>
            <Text style={styles.title}>기본 설정</Text>
            <TextInput
              onChangeText={setObserverInput}
              placeholder="조사자"
              placeholderTextColor={colors.subtext}
              style={styles.input}
              value={observerInput}
            />
            <TextInput
              onChangeText={setFarmsInput}
              placeholder="농가 목록"
              placeholderTextColor={colors.subtext}
              style={styles.input}
              value={farmsInput}
            />
            <TextInput
              autoCapitalize="none"
              onChangeText={setWebAppUrlInput}
              placeholder="Apps Script URL"
              placeholderTextColor={colors.subtext}
              style={styles.input}
              value={webAppUrlInput}
            />
            <ActionButton label="기본 설정 저장" onPress={() => void saveBasics()} />
          </Panel>

          <Panel style={styles.section}>
            <Text style={styles.title}>조사항목 사용 여부</Text>
            {(['비대조사', '품질조사', '추가조사'] as SurveyType[]).map((surveyType) => (
              <View key={surveyType} style={styles.toggleGroup}>
                <Text style={styles.subtitle}>{surveyType}</Text>
                {MEASUREMENT_ITEM_LABELS.map((itemName) => (
                  <View key={`${surveyType}-${itemName}`} style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>{itemName}</Text>
                    <Switch
                      onValueChange={() => toggleItem(surveyType, itemName)}
                      value={enabledItems[surveyType].includes(itemName)}
                    />
                  </View>
                ))}
              </View>
            ))}
          </Panel>

          <Panel style={styles.section}>
            <Text style={styles.title}>전문용어 등록</Text>
            <TextInput
              onChangeText={setCustomAlias}
              placeholder="예: 횡깅"
              placeholderTextColor={colors.subtext}
              style={styles.input}
              value={customAlias}
            />
            <TextInput
              onChangeText={(value) => setCustomCanonical(value as MeasurementItemName)}
              placeholder="표준 항목명"
              placeholderTextColor={colors.subtext}
              style={styles.input}
              value={customCanonical}
            />
            <ActionButton label="전문용어 저장" onPress={() => void addCustomTerm()} />
            {customTerms.map((term) => (
              <Text key={term.id} style={styles.help}>
                {term.alias} → {term.canonical}
              </Text>
            ))}
          </Panel>

          <Panel style={styles.section}>
            <Text style={styles.title}>시트에서 복구 / 초기화</Text>
            <Text style={styles.help}>
              과거값 복구는 `doGet(year, farm)` 응답 형식에 따라 일부 서버 보완이 필요할 수 있습니다.
            </Text>
            <View style={styles.actions}>
              <ActionButton label="시트에서 복구" onPress={() => void restoreFromSheet()} variant="secondary" />
              <ActionButton
                label="데이터 초기화"
                onPress={() =>
                  Alert.alert('데이터 초기화', '로컬 데이터가 모두 삭제됩니다.', [
                    { text: '취소', style: 'cancel' },
                    {
                      text: '삭제',
                      style: 'destructive',
                      onPress: async () => {
                        await databaseService.resetAllData();
                        setCustomTerms(await databaseService.listCustomTerms());
                        setValueRanges(await databaseService.getValueRanges());
                        Alert.alert('초기화 완료', '로컬 데이터가 초기화되었습니다.');
                      },
                    },
                  ])
                }
                variant="danger"
              />
            </View>
          </Panel>

          <Text style={styles.title}>값 범위 수정</Text>
        </>
      }
      renderItem={({ item }) => (
        <Panel style={styles.section}>
          <Text style={styles.subtitle}>{item.itemName}</Text>
          <View style={styles.rangeRow}>
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={(value) => {
                void saveRange(item.itemName, { minValue: Number(value || 0) });
              }}
              style={styles.input}
              value={String(item.minValue)}
            />
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={(value) => {
                void saveRange(item.itemName, { maxValue: Number(value || 0) });
              }}
              style={styles.input}
              value={String(item.maxValue)}
            />
          </View>
          <Text style={styles.help}>{item.warningMessage}</Text>
        </Panel>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.bg,
    gap: 12,
    padding: 12,
    paddingBottom: 32,
  },
  section: {
    gap: 10,
  },
  title: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  input: {
    backgroundColor: colors.panelMuted,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  toggleGroup: {
    gap: 8,
  },
  toggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  toggleLabel: {
    color: colors.subtext,
    fontSize: 14,
  },
  help: {
    color: colors.subtext,
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: 10,
  },
});
