import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TextInput, TouchableOpacity, Alert,
  Switch, ActivityIndicator,
} from 'react-native';
import { useSurveyStore } from '../stores/SurveyStore';
import { COLORS, SURVEY_TYPES, SurveyType } from '../utils/constants';
import { getConfig, setConfig, clearAllData } from '../services/DatabaseService';
import { fetchAndCacheHistory } from '../services/HistoryService';

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

  useEffect(() => {
    // DB에서 설정 로드
    async function load() {
      const obs = await getConfig('observer');
      const url = await getConfig('webAppUrl');
      const farms = await getConfig('farmList');
      const label = await getConfig('defaultLabel');
      const treatment = await getConfig('defaultTreatment');
      if (obs) { setObserverLocal(obs); setSession({ observer: obs }); }
      if (url) { setWebUrl(url); setWebAppUrl(url); }
      if (farms) setFarmList(JSON.parse(farms));
      if (label) { setDefaultLabel(label); setSession({ label }); }
      if (treatment) { setDefaultTreatment(treatment); setSession({ treatment }); }
    }
    load();
  }, []);

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
      Alert.alert('저장 완료', '설정이 저장되었습니다.');
    } finally {
      setSaving(false);
    }
  }

  function handleAddFarm() {
    const trimmed = newFarm.trim();
    if (!trimmed) return;
    if (farmList.includes(trimmed)) {
      Alert.alert('알림', '이미 있는 농가명입니다.'); return;
    }
    setFarmList([...farmList, trimmed]);
    setNewFarm('');
  }

  function handleRemoveFarm(name: string) {
    Alert.alert('삭제 확인', `"${name}" 농가를 삭제하시겠습니까?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => setFarmList(farmList.filter(f => f !== name)) },
    ]);
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
    Alert.alert(
      '데이터 초기화',
      '모든 조사 데이터가 삭제됩니다. 계속하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '초기화',
          style: 'destructive',
          onPress: async () => {
            await clearAllData();
            Alert.alert('완료', '데이터가 초기화되었습니다.');
          },
        },
      ]
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 조사자 이름 */}
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

      {/* Google Sheets */}
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
          <View key={farm} style={styles.farmRow}>
            <Text style={styles.farmName}>{farm}</Text>
            <TouchableOpacity onPress={() => handleRemoveFarm(farm)}>
              <Text style={{ color: COLORS.error, fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        <View style={styles.addFarmRow}>
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
          {downloading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.downloadBtnText}>과거 데이터 다운로드</Text>
          )}
        </TouchableOpacity>
      </Section>

      {/* 저장 버튼 */}
      <TouchableOpacity
        style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.saveBtnText}>설정 저장</Text>
        )}
      </TouchableOpacity>

      {/* 데이터 초기화 */}
      <TouchableOpacity style={styles.dangerBtn} onPress={handleClearData}>
        <Text style={styles.dangerBtnText}>데이터 초기화</Text>
      </TouchableOpacity>

      <Text style={styles.version}>감귤 생육조사 v1.0.0</Text>
    </ScrollView>
  );
}

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
  typeSelector: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    paddingVertical: 6, paddingHorizontal: 14,
    borderRadius: 8, backgroundColor: COLORS.card,
    borderWidth: 1, borderColor: COLORS.border,
  },
  typeBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeBtnText: { color: COLORS.textMuted, fontSize: 13 },
  farmRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border + '80',
  },
  farmName: { color: COLORS.text, fontSize: 14 },
  addFarmRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10,
  },
  addBtn: {
    backgroundColor: COLORS.primary, borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 16,
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  downloadBtn: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 10,
    margin: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  downloadBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  dangerBtn: {
    backgroundColor: COLORS.error + '22',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1, borderColor: COLORS.error + '66',
  },
  dangerBtnText: { color: COLORS.error, fontWeight: '600', fontSize: 14 },
  version: { color: COLORS.textDim, textAlign: 'center', fontSize: 11 },
});
