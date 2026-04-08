import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TextInput, TouchableOpacity, Alert,
  ActivityIndicator, Modal,
} from 'react-native';
import { useSurveyStore } from '../stores/SurveyStore';
import { COLORS, SURVEY_TYPES, SurveyType, DEFAULT_VALUE_RANGES, FIELD_UNITS } from '../utils/constants';
import {
  getConfig, setConfig, clearAllData,
  getCustomTerms, addCustomTerm, removeCustomTerm,
  getValueRanges, setValueRange, resetValueRange,
} from '../services/DatabaseService';
import { invalidateRangeCache } from '../services/ValidationService';
import { fetchAndCacheHistory } from '../services/HistoryService';

// ─── 항목 도움말 ──────────────────────────────────────────────────────────────
const FIELD_HELP: Record<string, string> = {
  횡경: '과실의 가로(적도) 지름 (mm). 기본 범위: 10~100mm.',
  종경: '과실의 세로(꼭지-배꼽) 길이 (mm). 기본 범위: 10~100mm.',
  과중: '과실 전체 무게 (g). 기본 범위: 5~300g.',
  당도: '굴절당도계 측정값 (Brix). 기본 범위: 3~25.',
  적정: '적정산도 (%). 기본 범위: 0.1~10.',
  산함량: '총 산함량 (%). 기본 범위: 0.1~10.',
  착색: '착색 비율 (%). 기본 범위: 0~100.',
  비파괴: '비파괴 당도계 측정값 (Brix). 기본 범위: 3~25.',
};

// 범위 설정 대상 항목
const RANGE_FIELDS = Object.keys(DEFAULT_VALUE_RANGES);

export default function SettingsScreen() {
  const {
    session, setSession,
    webAppUrl, setWebAppUrl,
    farmList, setFarmList,
  } = useSurveyStore();

  const [observer, setObserverLocal] = useState(session.observer);
  const [webUrl, setWebUrl] = useState(webAppUrl);
  const [newFarm, setNewFarm] = useState('');
  const [histYear, setHistYear] = useState(new Date().getFullYear().toString());
  const [histFarm, setHistFarm] = useState(session.farmName);
  const [downloading, setDownloading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [defaultLabel, setDefaultLabel] = useState(session.label);
  const [defaultTreatment, setDefaultTreatment] = useState(session.treatment);

  // 전문용어
  const [customTerms, setCustomTerms] = useState<string[]>([]);
  const [newTerm, setNewTerm] = useState('');

  // 범위 설정
  const [rangeInputs, setRangeInputs] = useState<Record<string, { min: string; max: string }>>({});
  const [helpField, setHelpField] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const obs       = await getConfig('observer');
      const url       = await getConfig('webAppUrl');
      const farms     = await getConfig('farmList');
      const label     = await getConfig('defaultLabel');
      const treatment = await getConfig('defaultTreatment');
      const terms     = await getCustomTerms();
      const dbRanges  = await getValueRanges();

      if (obs)   { setObserverLocal(obs); setSession({ observer: obs }); }
      if (url)   { setWebUrl(url); setWebAppUrl(url); }
      if (farms) { setFarmList(JSON.parse(farms)); }
      if (label) { setDefaultLabel(label); setSession({ label }); }
      if (treatment) { setDefaultTreatment(treatment); setSession({ treatment }); }
      setCustomTerms(Array.isArray(terms) ? terms : []);

      // 범위 input 초기화: DB 값 우선, 없으면 기본값
      const inputs: Record<string, { min: string; max: string }> = {};
      RANGE_FIELDS.forEach(field => {
        const dbVal = dbRanges[field];
        const def   = DEFAULT_VALUE_RANGES[field];
        inputs[field] = {
          min: String(dbVal ? dbVal.min : def.min),
          max: String(dbVal ? dbVal.max : def.max),
        };
      });
      setRangeInputs(inputs);
    } catch (e) {
      console.error('[SettingsScreen] loadAll error:', e);
    }
  }, []);

  useEffect(() => { loadAll().catch(e => console.error('[Settings effect]', e)); }, [loadAll]);

  async function handleSave() {
    setSaving(true);
    try {
      await setConfig('observer', observer);
      await setConfig('webAppUrl', webUrl);
      await setConfig('farmList', JSON.stringify(farmList));
      await setConfig('defaultLabel', defaultLabel);
      await setConfig('defaultTreatment', defaultTreatment);
      setSession({ observer, label: defaultLabel, treatment: defaultTreatment });
      setWebAppUrl(webUrl);

      // 범위 저장
      for (const field of RANGE_FIELDS) {
        const inp = rangeInputs[field];
        if (!inp) continue;
        const mn = parseFloat(inp.min);
        const mx = parseFloat(inp.max);
        if (!isNaN(mn) && !isNaN(mx) && mn < mx) {
          await setValueRange(field, mn, mx);
        }
      }
      invalidateRangeCache();

      Alert.alert('저장 완료', '설정이 저장되었습니다.');
    } finally {
      setSaving(false);
    }
  }

  function handleAddFarm() {
    const trimmed = newFarm.trim();
    if (!trimmed) return;
    if (farmList.includes(trimmed)) { Alert.alert('알림', '이미 있는 농가명입니다.'); return; }
    setFarmList([...farmList, trimmed]);
    setNewFarm('');
  }

  function handleRemoveFarm(name: string) {
    Alert.alert('삭제 확인', `"${name}" 농가를 삭제하시겠습니까?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => setFarmList(farmList.filter(f => f !== name)) },
    ]);
  }

  async function handleAddTerm() {
    const trimmed = newTerm.trim();
    if (!trimmed) return;
    if (customTerms.includes(trimmed)) { Alert.alert('알림', '이미 등록된 용어입니다.'); return; }
    await addCustomTerm(trimmed);
    setCustomTerms([...customTerms, trimmed]);
    setNewTerm('');
  }

  async function handleRemoveTerm(term: string) {
    await removeCustomTerm(term);
    setCustomTerms(customTerms.filter(t => t !== term));
  }

  async function handleResetRange(field: string) {
    await resetValueRange(field);
    invalidateRangeCache();
    const def = DEFAULT_VALUE_RANGES[field];
    setRangeInputs(prev => ({
      ...prev,
      [field]: { min: String(def.min), max: String(def.max) },
    }));
  }

  async function handleDownloadHistory() {
    if (!webUrl) { Alert.alert('오류', '앱스 스크립트 URL을 먼저 입력하세요.'); return; }
    if (!histFarm) { Alert.alert('오류', '농가명을 입력하세요.'); return; }
    setDownloading(true);
    try {
      await fetchAndCacheHistory(histFarm, histYear);
      Alert.alert('완료', `${histYear}년 ${histFarm} 과거 데이터를 다운로드했습니다.`);
    } catch (err) {
      Alert.alert('오류', `다운로드 실패: ${String(err)}`);
    } finally {
      setDownloading(false);
    }
  }

  async function handleClearData() {
    Alert.alert('데이터 초기화', '모든 조사 데이터가 삭제됩니다. 계속하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '초기화', style: 'destructive',
        onPress: async () => {
          await clearAllData();
          Alert.alert('완료', '데이터가 초기화되었습니다.');
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* 조사자 정보 */}
      <Section title="조사자 정보">
        <SettingRow label="조사자 이름">
          <TextInput
            style={styles.input}
            value={observer}
            onChangeText={setObserverLocal}
            placeholder="홍길동"
            placeholderTextColor={COLORS.textDim}
          />
        </SettingRow>
      </Section>

      {/* 조사 기본값 */}
      <Section title="조사 기본값">
        <SettingRow label="조사 유형">
          <View style={styles.typeSelector}>
            {SURVEY_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.typeBtn, session.surveyType === t && styles.typeBtnActive]}
                onPress={() => setSession({ surveyType: t as SurveyType })}
              >
                <Text style={[styles.typeBtnText, session.surveyType === t && { color: '#fff' }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </SettingRow>
        <SettingRow label="기본 라벨">
          <TextInput
            style={styles.input}
            value={defaultLabel}
            onChangeText={setDefaultLabel}
            placeholder="A"
            placeholderTextColor={COLORS.textDim}
          />
        </SettingRow>
        <SettingRow label="기본 처리구">
          <TextInput
            style={styles.input}
            value={defaultTreatment}
            onChangeText={setDefaultTreatment}
            placeholder="시험"
            placeholderTextColor={COLORS.textDim}
          />
        </SettingRow>
      </Section>

      {/* Google Sheets 연동 */}
      <Section title="Google Sheets 연동">
        <SettingRow label="앱스 스크립트 URL">
          <TextInput
            style={[styles.input, { fontSize: 11 }]}
            value={webUrl}
            onChangeText={setWebUrl}
            placeholder="https://script.google.com/..."
            placeholderTextColor={COLORS.textDim}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </SettingRow>
      </Section>

      {/* 농가 목록 */}
      <Section title="농가 목록">
        {farmList.map(farm => (
          <View key={farm} style={styles.listRow}>
            <Text style={styles.listItem}>{farm}</Text>
            <TouchableOpacity onPress={() => handleRemoveFarm(farm)}>
              <Text style={styles.removeBtn}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        <View style={styles.addRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={newFarm}
            onChangeText={setNewFarm}
            placeholder="농가명 추가"
            placeholderTextColor={COLORS.textDim}
          />
          <TouchableOpacity style={styles.addBtn} onPress={handleAddFarm}>
            <Text style={styles.addBtnText}>추가</Text>
          </TouchableOpacity>
        </View>
      </Section>

      {/* 전문용어 등록 */}
      <Section title="음성인식 전문용어">
        <Text style={styles.sectionNote}>
          등록된 용어는 음성인식 contextualStrings에 추가되어 인식률이 향상됩니다.
        </Text>
        {customTerms.length === 0 && (
          <Text style={styles.emptyNote}>등록된 용어 없음</Text>
        )}
        {customTerms.map(term => (
          <View key={term} style={styles.listRow}>
            <Text style={styles.listItem}>{term}</Text>
            <TouchableOpacity onPress={() => handleRemoveTerm(term)}>
              <Text style={styles.removeBtn}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        <View style={styles.addRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={newTerm}
            onChangeText={setNewTerm}
            placeholder="예: 노란반점, 궤양"
            placeholderTextColor={COLORS.textDim}
          />
          <TouchableOpacity style={styles.addBtn} onPress={handleAddTerm}>
            <Text style={styles.addBtnText}>추가</Text>
          </TouchableOpacity>
        </View>
      </Section>

      {/* 입력값 범위 설정 */}
      <Section title="입력값 범위 설정">
        <Text style={styles.sectionNote}>
          범위를 벗어난 값 입력 시 TTS 경고가 발생합니다. 저장 버튼을 눌러야 반영됩니다.
        </Text>
        {RANGE_FIELDS.map(field => {
          const inp = rangeInputs[field] ?? { min: '', max: '' };
          const unit = FIELD_UNITS[field] || '';
          const hasHelp = !!FIELD_HELP[field];
          return (
            <View key={field} style={styles.rangeRow}>
              <View style={styles.rangeLabel}>
                <Text style={styles.rangeLabelText}>{field}</Text>
                {unit ? <Text style={styles.rangeUnit}>{unit}</Text> : null}
                {hasHelp && (
                  <TouchableOpacity onPress={() => setHelpField(field)} style={styles.helpBtn}>
                    <Text style={styles.helpBtnText}>ⓘ</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.rangeInputs}>
                <TextInput
                  style={styles.rangeInput}
                  value={inp.min}
                  onChangeText={v => setRangeInputs(prev => ({ ...prev, [field]: { ...prev[field], min: v } }))}
                  keyboardType="decimal-pad"
                  placeholder="최솟값"
                  placeholderTextColor={COLORS.textDim}
                />
                <Text style={styles.rangeSep}>~</Text>
                <TextInput
                  style={styles.rangeInput}
                  value={inp.max}
                  onChangeText={v => setRangeInputs(prev => ({ ...prev, [field]: { ...prev[field], max: v } }))}
                  keyboardType="decimal-pad"
                  placeholder="최댓값"
                  placeholderTextColor={COLORS.textDim}
                />
                <TouchableOpacity onPress={() => handleResetRange(field)} style={styles.resetBtn}>
                  <Text style={styles.resetBtnText}>초기화</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </Section>

      {/* 과거 데이터 다운로드 */}
      <Section title="과거 데이터 다운로드">
        <SettingRow label="년도">
          <TextInput
            style={styles.input}
            value={histYear}
            onChangeText={setHistYear}
            keyboardType="number-pad"
            maxLength={4}
            placeholderTextColor={COLORS.textDim}
          />
        </SettingRow>
        <SettingRow label="농가명">
          <TextInput
            style={styles.input}
            value={histFarm}
            onChangeText={setHistFarm}
            placeholder="이원창"
            placeholderTextColor={COLORS.textDim}
          />
        </SettingRow>
        <TouchableOpacity
          style={[styles.downloadBtn, downloading && { opacity: 0.6 }]}
          onPress={handleDownloadHistory}
          disabled={downloading}
        >
          {downloading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.downloadBtnText}>과거 데이터 다운로드</Text>
          }
        </TouchableOpacity>
      </Section>

      {/* 저장 */}
      <TouchableOpacity
        style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text style={styles.saveBtnText}>설정 저장</Text>
        }
      </TouchableOpacity>

      {/* 데이터 초기화 */}
      <TouchableOpacity style={styles.dangerBtn} onPress={handleClearData}>
        <Text style={styles.dangerBtnText}>데이터 초기화</Text>
      </TouchableOpacity>

      <Text style={styles.version}>감귤 생육조사 v3.0.0</Text>

      {/* 도움말 모달 */}
      <Modal visible={helpField !== null} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setHelpField(null)}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{helpField} 도움말</Text>
            <Text style={styles.modalBody}>{helpField ? FIELD_HELP[helpField] : ''}</Text>
            <TouchableOpacity style={styles.modalClose} onPress={() => setHelpField(null)}>
              <Text style={styles.modalCloseText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

    </ScrollView>
  );
}

// ─── 공통 컴포넌트 ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={styles.settingValue}>{children}</View>
    </View>
  );
}

// ─── 스타일 ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 12, paddingBottom: 60 },

  section: { marginBottom: 16 },
  sectionTitle: {
    color: COLORS.textMuted, fontSize: 12, fontWeight: '600',
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  sectionContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
  },
  sectionNote: {
    color: COLORS.textDim, fontSize: 11,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4,
    lineHeight: 16,
  },
  emptyNote: {
    color: COLORS.textDim, fontSize: 12,
    paddingHorizontal: 14, paddingVertical: 8,
    fontStyle: 'italic',
  },

  settingRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border + '80',
    gap: 12,
  },
  settingLabel: { color: COLORS.textMuted, fontSize: 13, minWidth: 90 },
  settingValue: { flex: 1 },

  input: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    color: COLORS.text,
    fontSize: 14,
    paddingVertical: 8, paddingHorizontal: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },

  typeSelector: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  typeBtn: {
    paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 8, backgroundColor: COLORS.card,
    borderWidth: 1, borderColor: COLORS.border,
  },
  typeBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeBtnText: { color: COLORS.textMuted, fontSize: 12 },

  listRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border + '80',
  },
  listItem: { color: COLORS.text, fontSize: 14 },
  removeBtn: { color: COLORS.error, fontSize: 18, paddingHorizontal: 4 },

  addRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10,
  },
  addBtn: {
    backgroundColor: COLORS.primary, borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 16,
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  // 범위 설정
  rangeRow: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.border + '80',
    gap: 6,
  },
  rangeLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rangeLabelText: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  rangeUnit: { color: COLORS.textDim, fontSize: 11 },
  helpBtn: { marginLeft: 2 },
  helpBtnText: { color: COLORS.primary, fontSize: 14 },
  rangeInputs: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rangeInput: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 8,
    color: COLORS.text,
    fontSize: 13,
    paddingVertical: 6, paddingHorizontal: 10,
    borderWidth: 1, borderColor: COLORS.border,
    textAlign: 'center',
  },
  rangeSep: { color: COLORS.textMuted, fontSize: 14 },
  resetBtn: {
    backgroundColor: COLORS.card,
    borderRadius: 6,
    paddingVertical: 6, paddingHorizontal: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  resetBtnText: { color: COLORS.textDim, fontSize: 11 },

  downloadBtn: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 10, margin: 12, paddingVertical: 12, alignItems: 'center',
  },
  downloadBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 12,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  dangerBtn: {
    backgroundColor: COLORS.error + '22',
    borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 20,
    borderWidth: 1, borderColor: COLORS.error + '66',
  },
  dangerBtnText: { color: COLORS.error, fontWeight: '600', fontSize: 14 },

  version: { color: COLORS.textDim, textAlign: 'center', fontSize: 11 },

  // 모달
  modalOverlay: {
    flex: 1, backgroundColor: '#000000AA',
    justifyContent: 'center', alignItems: 'center',
  },
  modalBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 16, padding: 24, width: '80%',
    borderWidth: 1, borderColor: COLORS.border,
  },
  modalTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginBottom: 10 },
  modalBody: { color: COLORS.textMuted, fontSize: 14, lineHeight: 20 },
  modalClose: {
    marginTop: 16, alignSelf: 'flex-end',
    backgroundColor: COLORS.primary, borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 20,
  },
  modalCloseText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
