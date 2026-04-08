import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Modal, FlatList, Alert,
} from 'react-native';
import { useSurveyStore } from '../stores/SurveyStore';
import { COLORS, SURVEY_FIELDS_GROWTH, SURVEY_FIELDS_QUALITY, FIELD_UNITS } from '../utils/constants';
import {
  startRecognition, stopRecognition, requestPermissions,
  useSpeechRecognitionEvent, parseRecognitionResult,
  startClipRecording, stopClipRecording,
} from '../services/VoiceService';
import {
  upsertSample, upsertMeasurement, getMeasurementsMap,
  getSample, updateSampleMemo,
} from '../services/DatabaseService';
import { getPreviousValues, computeDiff } from '../services/HistoryService';
import { speak } from '../services/TTSService';
import { getUnsyncedCount } from '../services/SyncService';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

// ─── 비교 테이블 ──────────────────────────────────────────────────────────────

interface CompareTableProps {
  fields: string[];
  currentValues: Record<string, number>;
  previousValues: Record<string, number> | null;
  previousDate: string | null;
}

function CompareTable({ fields, currentValues, previousValues, previousDate }: CompareTableProps) {
  const measureFields = fields.filter(f => f !== '비고');
  if (measureFields.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableContainer}>
      <View>
        {/* 헤더 */}
        <View style={styles.tableRow}>
          <Text style={[styles.tableCell, styles.tableHeader, styles.tableLabelCell]}>구분</Text>
          {measureFields.map(f => (
            <Text key={f} style={[styles.tableCell, styles.tableHeader]}>{f}</Text>
          ))}
        </View>
        {/* 이전값 */}
        {previousValues && (
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableLabelCell, { color: COLORS.textMuted }]}>
              {previousDate ? previousDate.slice(5) : '이전'}
            </Text>
            {measureFields.map(f => (
              <Text key={f} style={[styles.tableCell, { color: COLORS.textMuted }]}>
                {previousValues[f] !== undefined ? previousValues[f] : '-'}
              </Text>
            ))}
          </View>
        )}
        {/* 현재값 */}
        <View style={styles.tableRow}>
          <Text style={[styles.tableCell, styles.tableLabelCell, { color: COLORS.primary }]}>오늘</Text>
          {measureFields.map(f => {
            const cv = currentValues[f];
            const pv = previousValues?.[f];
            let color = COLORS.text;
            let diffText = '';
            if (cv !== undefined && pv !== undefined) {
              const d = computeDiff(cv, pv);
              if (d.level === 'red') color = COLORS.red;
              else if (d.level === 'yellow') color = COLORS.yellow;
              const sign = cv > pv ? '+' : '';
              const pct = (d.diffPct * 100).toFixed(1);
              diffText = `${sign}${pct}%`;
            }
            return (
              <View key={f} style={styles.tableCellWrapper}>
                <Text style={[styles.tableCell, { color: cv !== undefined ? color : COLORS.textDim }]}>
                  {cv !== undefined ? cv : '-'}
                </Text>
                {diffText ? (
                  <Text style={{ fontSize: 9, color, textAlign: 'center' }}>{diffText}</Text>
                ) : null}
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

// ─── 수동 입력 모달 ───────────────────────────────────────────────────────────

interface ManualInputModalProps {
  visible: boolean;
  fields: string[];
  onSubmit: (field: string, value: number | string) => void;
  onClose: () => void;
}

function ManualInputModal({ visible, fields, onSubmit, onClose }: ManualInputModalProps) {
  const [selectedField, setSelectedField] = useState(fields[0] || '');
  const [value, setValue] = useState('');

  useEffect(() => {
    if (visible) { setSelectedField(fields[0] || ''); setValue(''); }
  }, [visible, fields]);

  function handleSubmit() {
    if (!selectedField || !value.trim()) return;
    if (selectedField === '비고') {
      onSubmit(selectedField, value.trim());
    } else {
      const num = parseFloat(value);
      if (isNaN(num)) { Alert.alert('오류', '숫자를 입력하세요.'); return; }
      onSubmit(selectedField, num);
    }
    setValue('');
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>수동 입력</Text>
          <Text style={styles.label}>항목 선택</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {fields.map(f => (
              <TouchableOpacity
                key={f}
                style={[styles.fieldChip, selectedField === f && styles.fieldChipSelected]}
                onPress={() => setSelectedField(f)}
              >
                <Text style={{ color: selectedField === f ? '#fff' : COLORS.textMuted, fontSize: 13 }}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.label}>
            값 {FIELD_UNITS[selectedField] ? `(${FIELD_UNITS[selectedField]})` : ''}
          </Text>
          <TextInput
            style={styles.textInput}
            value={value}
            onChangeText={setValue}
            keyboardType={selectedField === '비고' ? 'default' : 'decimal-pad'}
            placeholder={selectedField === '비고' ? '메모 입력' : '숫자 입력'}
            placeholderTextColor={COLORS.textDim}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            autoFocus
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.btnCancel} onPress={onClose}>
              <Text style={{ color: COLORS.textMuted }}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnConfirm} onPress={handleSubmit}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── 메인 화면 ────────────────────────────────────────────────────────────────

export default function SurveyScreen() {
  const {
    session, setSession,
    currentMeasurements, setCurrentMeasurements, updateMeasurement,
    currentSampleId, setCurrentSampleId,
    correctionMode, setCorrectionMode,
    voiceLogs, addVoiceLog,
    isListening, setIsListening,
    setUnsyncedCount,
  } = useSurveyStore();

  const [previousValues, setPreviousValues] = useState<Record<string, number> | null>(null);
  const [previousDate, setPreviousDate] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const clipPathRef = useRef<string | null>(null);

  const fields = session.surveyType === '비대조사'
    ? [...SURVEY_FIELDS_GROWTH]
    : [...SURVEY_FIELDS_QUALITY];

  // 현재 샘플 로드
  const loadCurrentSample = useCallback(async () => {
    const existing = await getSample(
      session.surveyDate, session.farmName, session.treeNo, session.fruitNo
    );
    if (existing) {
      setCurrentSampleId(existing.sample_id);
      const m = await getMeasurementsMap(existing.sample_id);
      setCurrentMeasurements(m);
    } else {
      setCurrentSampleId(null);
      setCurrentMeasurements({});
    }

    // 이전값 조회
    if (session.farmName) {
      const prev = await getPreviousValues(
        session.farmName, session.label, session.treatment,
        session.treeNo, session.fruitNo, session.surveyDate
      );
      if (prev) {
        setPreviousValues(prev.measurements);
        setPreviousDate(prev.surveyDate);
      } else {
        setPreviousValues(null);
        setPreviousDate(null);
      }
    }
  }, [session.surveyDate, session.farmName, session.treeNo, session.fruitNo, session.label, session.treatment, setCurrentSampleId, setCurrentMeasurements]);

  useEffect(() => { loadCurrentSample(); }, [loadCurrentSample]);

  // 권한 확인
  useEffect(() => {
    requestPermissions().then(setPermissionsGranted);
  }, []);

  // 샘플 upsert & 측정값 저장
  async function saveMeasurement(
    field: string,
    value: number | string,
    inputMethod: 'voice' | 'manual',
    rawVoiceText: string = '',
    audioClipPath: string = ''
  ) {
    // 샘플 생성 또는 확인
    let sampleId = currentSampleId;
    if (!sampleId) {
      sampleId = uuidv4();
      const now = new Date().toISOString();
      await upsertSample({
        sample_id: sampleId,
        survey_date: session.surveyDate,
        survey_type: session.surveyType,
        farm_name: session.farmName,
        label: session.label,
        treatment: session.treatment,
        tree_no: session.treeNo,
        fruit_no: session.fruitNo,
        memo: '',
        observer: session.observer,
        sync_status: 0,
        created_at: now,
        updated_at: now,
      });
      setCurrentSampleId(sampleId);
    }

    if (field === '비고') {
      await updateSampleMemo(sampleId, String(value));
      updateMeasurement('비고', value as number);
    } else {
      const num = typeof value === 'number' ? value : parseFloat(String(value));
      await upsertMeasurement({
        measurement_id: uuidv4(),
        sample_id: sampleId,
        item_name: field,
        item_value: num,
        input_method: inputMethod,
        raw_voice_text: rawVoiceText,
        audio_clip_path: audioClipPath,
        updated_at: new Date().toISOString(),
      });
      updateMeasurement(field, num);
    }

    const count = await getUnsyncedCount();
    setUnsyncedCount(count);
  }

  // 음성인식 이벤트
  useSpeechRecognitionEvent('result', async (event) => {
    if (!event.isFinal) return;

    // 녹음 중지
    const clipPath = await stopClipRecording();
    clipPathRef.current = clipPath;

    const cmd = parseRecognitionResult(event);

    const logEntry = {
      id: uuidv4(),
      timestamp: new Date().toLocaleTimeString('ko-KR'),
      rawText: cmd.rawText,
      parsedType: cmd.type,
      parsedField: cmd.field,
      parsedValue: cmd.value,
      success: cmd.type !== 'unknown',
    };
    addVoiceLog(logEntry);

    if (cmd.type === 'correction') {
      setCorrectionMode(true);
      speak('수정 모드');
      return;
    }

    if (cmd.type === 'context' && cmd.contextKey && cmd.contextValue !== undefined) {
      const updates: Record<string, unknown> = {};
      if (cmd.contextKey === 'treeNo') updates.treeNo = cmd.contextValue as number;
      else if (cmd.contextKey === 'fruitNo') updates.fruitNo = cmd.contextValue as number;
      else if (cmd.contextKey === 'farmName') updates.farmName = cmd.contextValue as string;
      else if (cmd.contextKey === 'label') updates.label = cmd.contextValue as string;
      else if (cmd.contextKey === 'treatment') updates.treatment = cmd.contextValue as string;
      setSession(updates as Parameters<typeof setSession>[0]);
      speak(`${cmd.contextKey === 'farmName' ? '농가' : cmd.contextKey} ${cmd.contextValue}`);
      setCorrectionMode(false);
      return;
    }

    if (cmd.type === 'memo' && cmd.field) {
      await saveMeasurement('비고', cmd.field, 'voice', cmd.rawText, clipPath || '');
      speak('비고 저장');
      setCorrectionMode(false);
      return;
    }

    if (cmd.type === 'measurement' && cmd.field !== undefined && cmd.value !== undefined) {
      // 수정 모드가 아니고 이미 값이 있으면 경고 없이 overwrite (수정 모드 해제)
      await saveMeasurement(cmd.field, cmd.value, 'voice', cmd.rawText, clipPath || '');
      speak(`${cmd.field} ${cmd.value}`);
      setCorrectionMode(false);
      return;
    }

    // 다음 발화를 위한 녹음 재시작
    if (isListening) {
      await startClipRecording();
    }
  });

  useSpeechRecognitionEvent('start', async () => {
    setIsListening(true);
    await startClipRecording();
  });

  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
  });

  useSpeechRecognitionEvent('error', (event) => {
    console.warn('Speech error:', event);
    setIsListening(false);
  });

  // 마이크 버튼
  async function handleMicPress() {
    if (!permissionsGranted) {
      const ok = await requestPermissions();
      setPermissionsGranted(ok);
      if (!ok) { Alert.alert('권한 필요', '마이크 및 음성인식 권한이 필요합니다.'); return; }
    }
    if (isListening) {
      stopRecognition();
    } else {
      startRecognition();
    }
  }

  function adjustTreeNo(delta: number) {
    const next = Math.max(1, session.treeNo + delta);
    setSession({ treeNo: next });
  }

  function adjustFruitNo(delta: number) {
    const next = Math.max(1, session.fruitNo + delta);
    setSession({ fruitNo: next });
  }

  async function handleManualSubmit(field: string, value: number | string) {
    await saveMeasurement(field, value, 'manual');
    setShowManualInput(false);
  }

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        {/* 컨텍스트 헤더 */}
        <View style={styles.contextCard}>
          <View style={styles.contextRow}>
            <ContextBadge label="농가" value={session.farmName || '미설정'} />
            <ContextBadge label="라벨" value={session.label} />
            <ContextBadge label="처리" value={session.treatment} />
            <ContextBadge label="유형" value={session.surveyType} />
          </View>
          <Text style={styles.dateText}>{session.surveyDate}</Text>
        </View>

        {/* 나무/과실 선택 */}
        <View style={styles.sampleSelector}>
          <StepperControl
            label="조사나무"
            value={session.treeNo}
            onDecrement={() => adjustTreeNo(-1)}
            onIncrement={() => adjustTreeNo(1)}
          />
          <StepperControl
            label="조사과실"
            value={session.fruitNo}
            onDecrement={() => adjustFruitNo(-1)}
            onIncrement={() => adjustFruitNo(1)}
          />
        </View>

        {/* 비교 테이블 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>측정값 비교</Text>
          <CompareTable
            fields={fields}
            currentValues={currentMeasurements}
            previousValues={previousValues}
            previousDate={previousDate}
          />
        </View>

        {/* 음성 로그 */}
        {voiceLogs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>음성 로그</Text>
            {voiceLogs.slice(0, 5).map(log => (
              <View key={log.id} style={styles.logRow}>
                <Text style={styles.logTime}>{log.timestamp}</Text>
                <Text style={[styles.logText, !log.success && { color: COLORS.textDim }]}>
                  {log.rawText}
                </Text>
                {log.parsedField && log.parsedValue !== undefined && (
                  <Text style={styles.logParsed}>{log.parsedField}: {log.parsedValue}</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* 하단 컨트롤 */}
      <View style={styles.bottomBar}>
        {correctionMode && (
          <View style={styles.correctionBadge}>
            <Text style={styles.correctionText}>✏️ 수정 모드</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.manualBtn}
          onPress={() => setShowManualInput(true)}
        >
          <Text style={styles.manualBtnText}>수동 입력</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.micButton, isListening && styles.micButtonActive]}
          onPress={handleMicPress}
        >
          <Text style={styles.micIcon}>{isListening ? '⏹' : '🎙'}</Text>
          <Text style={styles.micLabel}>{isListening ? '중지' : '음성 시작'}</Text>
        </TouchableOpacity>
      </View>

      <ManualInputModal
        visible={showManualInput}
        fields={fields}
        onSubmit={handleManualSubmit}
        onClose={() => setShowManualInput(false)}
      />
    </View>
  );
}

// ─── 서브 컴포넌트 ─────────────────────────────────────────────────────────────

function ContextBadge({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.contextBadge}>
      <Text style={styles.contextBadgeLabel}>{label}</Text>
      <Text style={styles.contextBadgeValue}>{value}</Text>
    </View>
  );
}

function StepperControl({
  label, value, onDecrement, onIncrement,
}: { label: string; value: number; onDecrement: () => void; onIncrement: () => void }) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperRow}>
        <TouchableOpacity style={styles.stepBtn} onPress={onDecrement}>
          <Text style={styles.stepBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.stepValue}>{value}</Text>
        <TouchableOpacity style={styles.stepBtn} onPress={onIncrement}>
          <Text style={styles.stepBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── 스타일 ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scrollContent: { padding: 12, paddingBottom: 160 },
  contextCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  contextRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  contextBadge: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  contextBadgeLabel: { fontSize: 10, color: COLORS.textDim, marginBottom: 2 },
  contextBadgeValue: { fontSize: 13, color: COLORS.text, fontWeight: '600' },
  dateText: { color: COLORS.textMuted, fontSize: 12, marginTop: 8 },
  sampleSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  stepper: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stepperLabel: { color: COLORS.textMuted, fontSize: 12, marginBottom: 8 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepBtn: {
    backgroundColor: COLORS.card,
    width: 36, height: 36,
    borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnText: { color: COLORS.primary, fontSize: 20, fontWeight: 'bold' },
  stepValue: { color: COLORS.text, fontSize: 24, fontWeight: 'bold', minWidth: 32, textAlign: 'center' },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: { color: COLORS.textMuted, fontSize: 12, marginBottom: 8, fontWeight: '600' },
  tableContainer: { marginHorizontal: -4 },
  tableRow: { flexDirection: 'row' },
  tableCell: {
    minWidth: 56, paddingHorizontal: 4, paddingVertical: 6,
    fontSize: 12, textAlign: 'center', color: COLORS.text,
  },
  tableCellWrapper: { minWidth: 56, alignItems: 'center' },
  tableHeader: { color: COLORS.textMuted, fontWeight: '600', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tableLabelCell: { minWidth: 48, fontSize: 11 },
  logRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  logTime: { color: COLORS.textDim, fontSize: 10, minWidth: 52 },
  logText: { color: COLORS.text, fontSize: 12, flex: 1 },
  logParsed: { color: COLORS.primary, fontSize: 11, fontWeight: '600' },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  correctionBadge: {
    backgroundColor: COLORS.accent + '33',
    borderRadius: 8,
    paddingVertical: 6, paddingHorizontal: 10,
    borderWidth: 1, borderColor: COLORS.accent,
  },
  correctionText: { color: COLORS.accent, fontSize: 13, fontWeight: '600' },
  manualBtn: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  manualBtnText: { color: COLORS.textMuted, fontSize: 14 },
  micButton: {
    flex: 1,
    backgroundColor: COLORS.mic,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  micButtonActive: { backgroundColor: COLORS.micActive },
  micIcon: { fontSize: 28 },
  micLabel: { color: '#fff', fontWeight: '700', fontSize: 14 },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: '#000a',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20,
    borderWidth: 1, borderColor: COLORS.border,
  },
  modalTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700', marginBottom: 16 },
  label: { color: COLORS.textMuted, fontSize: 12, marginBottom: 8 },
  fieldChip: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    paddingVertical: 6, paddingHorizontal: 12,
    marginRight: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  fieldChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  textInput: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    color: COLORS.text,
    fontSize: 18,
    paddingVertical: 12, paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  modalButtons: { flexDirection: 'row', gap: 12 },
  btnCancel: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  btnConfirm: {
    flex: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
});
