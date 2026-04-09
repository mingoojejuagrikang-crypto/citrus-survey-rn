import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, TextInput, Modal, Alert, Platform,
} from 'react-native';
import { useSurveyStore } from '../stores/SurveyStore';
import { COLORS, SURVEY_FIELDS_GROWTH, SURVEY_FIELDS_QUALITY, SURVEY_TYPES, SurveyType } from '../utils/constants';
import {
  startRecognition, stopRecognition, requestPermissions,
  useSpeechRecognitionEvent,
} from '../services/VoiceService';
import {
  upsertSample, upsertMeasurement, getMeasurementsMap,
  getSample, updateSampleMemo, getMeasurements,
  getConfig,
} from '../services/DatabaseService';
import { getPreviousValues, computeDiff } from '../services/HistoryService';
import { speak } from '../services/TTSService';
import { getUnsyncedCount } from '../services/SyncService';
import { parseBestAlternative, ParsedToken } from '../services/ParserService';
import { checkRequired, checkRange } from '../services/ValidationService';
import { pushUndo, popUndo } from '../services/UndoService';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

// ─── 비교 테이블 (가로 스크롤만) ─────────────────────────────────────────────
function CompareTable({
  fields, currentValues, previousValues, previousDate, outOfRangeFields,
}: {
  fields: string[];
  currentValues: Record<string, number>;
  previousValues: Record<string, number> | null;
  previousDate: string | null;
  outOfRangeFields: Set<string>;
}) {
  const mFields = fields.filter(f => f !== '비고' && f !== '병해충');
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        <View style={styles.tableRow}>
          <Text style={[styles.cell, styles.labelCell, styles.headerCell]}>구분</Text>
          {mFields.map(f => (
            <Text key={f} style={[styles.cell, styles.headerCell]}>{f}</Text>
          ))}
        </View>
        {previousValues && (
          <View style={styles.tableRow}>
            <Text style={[styles.cell, styles.labelCell, { color: COLORS.textDim }]}>
              {previousDate?.slice(5) ?? '이전'}
            </Text>
            {mFields.map(f => (
              <Text key={f} style={[styles.cell, { color: COLORS.textDim }]}>
                {previousValues[f] ?? '-'}
              </Text>
            ))}
          </View>
        )}
        <View style={styles.tableRow}>
          <Text style={[styles.cell, styles.labelCell, { color: COLORS.primary }]}>오늘</Text>
          {mFields.map(f => {
            const cv = currentValues[f];
            const pv = previousValues?.[f];
            const outOfRange = outOfRangeFields.has(f);
            let color = outOfRange ? COLORS.red : COLORS.text;
            let diffText = '';
            if (cv !== undefined && pv !== undefined) {
              const d = computeDiff(cv, pv);
              if (!outOfRange) {
                if (d.level === 'red') color = COLORS.red;
                else if (d.level === 'yellow') color = COLORS.yellow;
              }
              const sign = cv > pv ? '+' : '';
              diffText = `${sign}${(d.diffPct * 100).toFixed(1)}%`;
            }
            return (
              <View key={f} style={styles.cellWrapper}>
                <Text style={[styles.cell, { color: cv !== undefined ? color : COLORS.textDim }]}>
                  {cv !== undefined ? cv : '-'}
                </Text>
                {diffText ? <Text style={{ fontSize: 9, color, textAlign: 'center' }}>{diffText}</Text> : null}
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

// ─── 수동 입력 모달 ───────────────────────────────────────────────────────────
function ManualInputModal({
  visible, fields, onSubmit, onClose,
}: { visible: boolean; fields: string[]; onSubmit: (f: string, v: number | string) => void; onClose: () => void }) {
  const [sel, setSel] = useState(fields[0] || '');
  const [val, setVal] = useState('');

  useEffect(() => { if (visible) { setSel(fields[0] || ''); setVal(''); } }, [visible, fields]);

  function submit() {
    if (!sel || !val.trim()) return;
    if (sel === '비고') { onSubmit(sel, val.trim()); return; }
    const n = parseFloat(val);
    if (isNaN(n)) { Alert.alert('오류', '숫자를 입력하세요.'); return; }
    onSubmit(sel, n);
    setVal('');
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>수동 입력</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            {fields.map(f => (
              <TouchableOpacity
                key={f}
                style={[styles.chip, sel === f && styles.chipSelected]}
                onPress={() => setSel(f)}
              >
                <Text style={{ color: sel === f ? '#fff' : COLORS.textMuted, fontSize: 13 }}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TextInput
            style={styles.textInput}
            value={val}
            onChangeText={setVal}
            keyboardType={sel === '비고' ? 'default' : 'decimal-pad'}
            placeholder={sel === '비고' ? '메모 입력' : '숫자 입력'}
            placeholderTextColor={COLORS.textDim}
            returnKeyType="done"
            onSubmitEditing={submit}
            autoFocus
          />
          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.btnCancel} onPress={onClose}>
              <Text style={{ color: COLORS.textMuted }}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnConfirm} onPress={submit}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── 세션 필드 편집 모달 ─────────────────────────────────────────────────────
type EditTarget = 'farmName' | 'label' | 'treatment';

function SessionEditModal({
  visible, target, currentValue, farmList, onConfirm, onClose,
}: {
  visible: boolean;
  target: EditTarget | null;
  currentValue: string;
  farmList: string[];
  onConfirm: (val: string) => void;
  onClose: () => void;
}) {
  const [val, setVal] = useState('');
  useEffect(() => { if (visible) setVal(currentValue); }, [visible, currentValue]);

  const title = target === 'farmName' ? '농가명' : target === 'label' ? '라벨' : '처리구';

  function confirm() {
    const trimmed = val.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title} 입력</Text>

          {/* 농가명은 저장된 목록 퀵픽 제공 */}
          {target === 'farmName' && farmList.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {farmList.map(f => (
                <TouchableOpacity
                  key={f}
                  style={[styles.chip, val === f && styles.chipSelected]}
                  onPress={() => { setVal(f); }}
                >
                  <Text style={{ color: val === f ? '#fff' : COLORS.textMuted, fontSize: 13 }}>{f}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <TextInput
            style={styles.textInput}
            value={val}
            onChangeText={setVal}
            placeholder={`${title} 입력`}
            placeholderTextColor={COLORS.textDim}
            returnKeyType="done"
            onSubmitEditing={confirm}
            autoFocus
            autoCapitalize="none"
          />
          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.btnCancel} onPress={onClose}>
              <Text style={{ color: COLORS.textMuted }}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnConfirm} onPress={confirm}>
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
    farmList,
  } = useSurveyStore();

  const [prevValues, setPrevValues] = useState<Record<string, number> | null>(null);
  const [prevDate, setPrevDate] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [outOfRangeFields, setOutOfRangeFields] = useState<Set<string>>(new Set());
  const [lastVoiceText, setLastVoiceText] = useState('');

  // 세션 편집 모달
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  // 조사자 자동 로드 (DB 설정값, 수정 불가)
  useEffect(() => {
    getConfig('observer')
      .then(obs => { if (obs) setSession({ observer: obs }); })
      .catch(e => console.error('[SurveyScreen] observer load error:', e));
  }, []);

  const fields = session.surveyType === '비대조사'
    ? [...SURVEY_FIELDS_GROWTH]
    : session.surveyType === '품질조사'
    ? [...SURVEY_FIELDS_QUALITY]
    : [...SURVEY_FIELDS_QUALITY]; // 추가조사도 품질 필드 기준

  // 현재 샘플 로드
  const loadSample = useCallback(async () => {
    if (!session.farmName) return;
    const existing = await getSample(session.surveyDate, session.farmName, session.treeNo, session.fruitNo);
    if (existing) {
      setCurrentSampleId(existing.sample_id);
      const m = await getMeasurementsMap(existing.sample_id);
      setCurrentMeasurements(m);
    } else {
      setCurrentSampleId(null);
      setCurrentMeasurements({});
    }
    if (session.farmName) {
      const prev = await getPreviousValues(
        session.farmName, session.label, session.treatment,
        session.treeNo, session.fruitNo, session.surveyDate
      );
      setPrevValues(prev?.measurements ?? null);
      setPrevDate(prev?.surveyDate ?? null);
    }
  }, [session.surveyDate, session.farmName, session.treeNo, session.fruitNo,
      session.label, session.treatment, setCurrentSampleId, setCurrentMeasurements]);

  useEffect(() => { loadSample().catch(e => console.error('[SurveyScreen] loadSample error:', e)); }, [loadSample]);

  // 샘플 upsert + 측정값 저장
  async function saveMeasurement(
    field: string, value: number | string,
    inputMethod: 'voice' | 'manual', rawText = ''
  ) {
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
      updateMeasurement('비고', 0);
    } else if (field === '병해충') {
      // 텍스트 타입 — raw_voice_text에 저장, item_value는 null
      await upsertMeasurement({
        measurement_id: uuidv4(),
        sample_id: sampleId,
        item_name: field,
        item_value: null,
        input_method: inputMethod,
        raw_voice_text: String(value),
        audio_clip_path: '',
        updated_at: new Date().toISOString(),
      });
      updateMeasurement(field, 0);
    } else {
      const num = typeof value === 'number' ? value : parseFloat(String(value));
      // undo 스택에 이전값 저장
      const prev = currentMeasurements[field];
      await pushUndo({
        sampleId, itemName: field,
        previousValue: prev ?? null,
        actionType: prev !== undefined ? 'set' : 'set',
      });
      await upsertMeasurement({
        measurement_id: uuidv4(),
        sample_id: sampleId,
        item_name: field,
        item_value: num,
        input_method: inputMethod,
        raw_voice_text: rawText,
        audio_clip_path: '',
        updated_at: new Date().toISOString(),
      });
      updateMeasurement(field, num);
      // 범위 체크
      const rangeResult = await checkRange(field, num);
      setOutOfRangeFields(prev => {
        const next = new Set(prev);
        if (!rangeResult.inRange) next.add(field);
        else next.delete(field);
        return next;
      });
    }
    const count = await getUnsyncedCount();
    setUnsyncedCount(count);
  }

  // 취소 실행
  async function executeUndo() {
    const entry = await popUndo();
    if (!entry) { speak('취소할 항목 없음'); return; }
    if (entry.previousValue === null) {
      // 이전값이 없었으면 해당 측정값 삭제
      const db = (await import('../services/DatabaseService')).getDB;
      // 단순히 UI에서 제거
      const newM = { ...currentMeasurements };
      delete newM[entry.itemName];
      setCurrentMeasurements(newM);
    } else {
      await upsertMeasurement({
        measurement_id: uuidv4(),
        sample_id: entry.sampleId,
        item_name: entry.itemName,
        item_value: entry.previousValue,
        input_method: 'manual',
        raw_voice_text: '',
        audio_clip_path: '',
        updated_at: new Date().toISOString(),
      });
      updateMeasurement(entry.itemName, entry.previousValue);
    }
    speak('취소');
  }

  // 단일 토큰 처리 (한 번에 하나씩 입력 방식)
  async function processToken(token: ParsedToken) {
    if (token.type === 'correction') {
      setCorrectionMode(true);
      speak('수정');
      addVoiceLog({ id: uuidv4(), timestamp: ts(), rawText: token.raw, parsedType: 'correction', success: true });

    } else if (token.type === 'cancel') {
      await executeUndo();
      addVoiceLog({ id: uuidv4(), timestamp: ts(), rawText: token.raw, parsedType: 'cancel', success: true });

    } else if (token.type === 'context') {
      const updates: Record<string, unknown> = {};
      const k = token.key;
      if (k === 'treeNo')    updates.treeNo    = token.value as number;
      else if (k === 'fruitNo')   updates.fruitNo   = token.value as number;
      else if (k === 'farmName')  updates.farmName  = token.value as string;
      else if (k === 'label')     updates.label     = token.value as string;
      else if (k === 'treatment') updates.treatment = token.value as string;
      setSession(updates as Parameters<typeof setSession>[0]);
      speak(token.raw);
      addVoiceLog({ id: uuidv4(), timestamp: ts(), rawText: token.raw, parsedType: 'context', parsedField: token.key, success: true });
      setCorrectionMode(false);

    } else if (token.type === 'text_field') {
      // 병해충, 비고 텍스트 저장
      await saveMeasurement(token.field, token.value, 'voice', token.raw);
      speak(`${token.field} ${token.value}`);
      addVoiceLog({ id: uuidv4(), timestamp: ts(), rawText: token.raw, parsedType: 'text_field', parsedField: token.field, success: true });
      setCorrectionMode(false);

    } else if (token.type === 'measurement') {
      const rangeResult = await checkRange(token.field, token.value);
      const ttsText = rangeResult.inRange
        ? `${token.field} ${token.value}`
        : `${token.field} ${token.value} 확인`;
      await saveMeasurement(token.field, token.value, 'voice', token.raw);
      speak(ttsText);
      addVoiceLog({
        id: uuidv4(), timestamp: ts(), rawText: token.raw,
        parsedType: 'measurement', parsedField: token.field,
        parsedValue: token.value, success: true,
        outOfRange: !rangeResult.inRange,
      });
      setCorrectionMode(false);
    }
  }

  // 음성인식 이벤트 — 한 번에 하나씩 처리
  useSpeechRecognitionEvent('result', async (event) => {
    try {
      if (!event.isFinal) return;

      const alternatives: string[] = event.results
        ? event.results.map((r: { transcript: string }) => r.transcript)
        : [];
      if (alternatives.length === 0) return;

      setLastVoiceText(alternatives[0]);

      const token = parseBestAlternative(alternatives, {});
      await processToken(token);
    } catch (e) {
      console.error('[SurveyScreen] voice result error:', e);
    }
  });

  useSpeechRecognitionEvent('start', () => setIsListening(true));
  useSpeechRecognitionEvent('end', () => setIsListening(false));
  useSpeechRecognitionEvent('error', () => setIsListening(false));

  // 마이크 버튼
  async function handleMicPress() {
    if (isListening) {
      stopRecognition();
      speak('음성입력 종료');
      return;
    }

    // 권한 확인
    const ok = await requestPermissions();
    if (!ok) { Alert.alert('권한 필요', '마이크 및 음성인식 권한이 필요합니다.'); return; }

    // 필수값 체크 (4개: 조사자, 농가명, 조사유형, URL)
    const webAppUrl = await getConfig('webAppUrl');
    const result = checkRequired({
      observer: session.observer,
      farmName: session.farmName,
      surveyType: session.surveyType,
      webAppUrl: webAppUrl ?? '',
    });
    if (!result.ok) {
      speak(result.message);
      Alert.alert('입력 필요', result.message);
      return;
    }

    speak('음성입력 시작');
    startRecognition();
  }

  function ts() { return new Date().toLocaleTimeString('ko-KR'); }

  return (
    <View style={styles.container}>
      {/* ① 컨텍스트 헤더 — 탭으로 편집 */}
      <View style={styles.contextBar}>
        {/* 편집 가능 배지 */}
        <CtxEditBadge
          label="농가"
          value={session.farmName || '탭하여 입력'}
          alert={!session.farmName}
          onPress={() => setEditTarget('farmName')}
        />
        <CtxEditBadge
          label="라벨"
          value={session.label || '-'}
          onPress={() => setEditTarget('label')}
        />
        <CtxEditBadge
          label="처리구"
          value={session.treatment || '-'}
          onPress={() => setEditTarget('treatment')}
        />
        {/* 조사유형: 탭으로 순환 */}
        <TouchableOpacity
          style={[styles.ctxBadge, styles.ctxBadgeEditable]}
          onPress={() => {
            const idx = SURVEY_TYPES.indexOf(session.surveyType as SurveyType);
            const next = SURVEY_TYPES[(idx + 1) % SURVEY_TYPES.length];
            setSession({ surveyType: next });
          }}
        >
          <Text style={styles.ctxLabel}>유형 ✎</Text>
          <Text style={[styles.ctxValue, { color: COLORS.primary }]}>{session.surveyType}</Text>
        </TouchableOpacity>
        {/* 조사자: 잠금 (설정에서 관리) */}
        <View style={[styles.ctxBadge, styles.ctxBadgeLocked]}>
          <Text style={styles.ctxLabel}>조사자 🔒</Text>
          <Text style={[styles.ctxValue, { color: COLORS.textMuted }]}>
            {session.observer || '설정 필요'}
          </Text>
        </View>
      </View>

      {/* ② 나무/과실 선택 */}
      <View style={styles.sampleRow}>
        <Stepper label="나무" value={session.treeNo}
          onDec={() => setSession({ treeNo: Math.max(1, session.treeNo - 1) })}
          onInc={() => setSession({ treeNo: session.treeNo + 1 })} />
        <Stepper label="과실" value={session.fruitNo}
          onDec={() => setSession({ fruitNo: Math.max(1, session.fruitNo - 1) })}
          onInc={() => setSession({ fruitNo: session.fruitNo + 1 })} />
      </View>

      {/* ③ 비교 테이블 */}
      <View style={styles.tableSection}>
        <CompareTable
          fields={fields}
          currentValues={currentMeasurements}
          previousValues={prevValues}
          previousDate={prevDate}
          outOfRangeFields={outOfRangeFields}
        />
      </View>

      {/* ④ 음성 로그 (고정 높이) */}
      <View style={styles.logSection}>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {voiceLogs.length === 0 ? (
            <Text style={styles.logEmpty}>음성 입력 대기 중…</Text>
          ) : (
            voiceLogs.slice(0, 8).map(log => (
              <View key={log.id} style={styles.logRow}>
                <Text style={styles.logTime}>{log.timestamp}</Text>
                <View style={{ flex: 1 }}>
                  {log.parsedType === 'measurement' && log.parsedField !== undefined ? (
                    <Text style={[styles.logMain, log.outOfRange && { color: COLORS.red }]}>
                      {log.parsedField}: {log.parsedValue}
                      {log.outOfRange ? ' ⚠️' : ''}
                    </Text>
                  ) : log.parsedType === 'correction' ? (
                    <Text style={[styles.logMain, { color: COLORS.accent }]}>✏️ 수정 모드</Text>
                  ) : log.parsedType === 'cancel' ? (
                    <Text style={[styles.logMain, { color: COLORS.warning }]}>↩ 취소</Text>
                  ) : log.parsedType === 'context' ? (
                    <Text style={[styles.logMain, { color: COLORS.success }]}>{log.rawText}</Text>
                  ) : (
                    <Text style={{ color: COLORS.textDim, fontSize: 11 }}>
                      {log.rawText.slice(0, 40)}{log.rawText.length > 40 ? '…' : ''}
                    </Text>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>

      {/* ⑤ 하단 고정 바 */}
      <View style={styles.bottomBar}>
        {correctionMode && (
          <View style={styles.corrBadge}>
            <Text style={styles.corrText}>✏️ 수정</Text>
          </View>
        )}
        <TouchableOpacity style={styles.manualBtn} onPress={() => setShowManual(true)}>
          <Text style={styles.manualBtnText}>수동 입력</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.micBtn, isListening && styles.micBtnActive]}
          onPress={handleMicPress}
        >
          <Text style={styles.micIcon}>{isListening ? '⏹' : '🎙'}</Text>
          <Text style={styles.micLabel}>{isListening ? '중지' : '음성 시작'}</Text>
        </TouchableOpacity>
      </View>

      <ManualInputModal
        visible={showManual}
        fields={fields}
        onSubmit={async (f, v) => { await saveMeasurement(f, v, 'manual'); setShowManual(false); }}
        onClose={() => setShowManual(false)}
      />

      <SessionEditModal
        visible={editTarget !== null}
        target={editTarget}
        currentValue={editTarget ? (session[editTarget] as string) : ''}
        farmList={farmList}
        onConfirm={(val) => {
          if (editTarget) setSession({ [editTarget]: val } as Parameters<typeof setSession>[0]);
          setEditTarget(null);
        }}
        onClose={() => setEditTarget(null)}
      />
    </View>
  );
}

// ─── 서브 컴포넌트 ─────────────────────────────────────────────────────────────
function CtxEditBadge({ label, value, alert, onPress }: {
  label: string; value: string; alert?: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.ctxBadge, styles.ctxBadgeEditable, alert && styles.ctxBadgeAlert]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.ctxLabel}>{label} ✎</Text>
      <Text style={[styles.ctxValue, alert && { color: COLORS.warning }]}>{value}</Text>
    </TouchableOpacity>
  );
}

function Stepper({ label, value, onDec, onInc }: { label: string; value: number; onDec: () => void; onInc: () => void }) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepLabel}>{label}</Text>
      <View style={styles.stepRow}>
        <TouchableOpacity style={styles.stepBtn} onPress={onDec}>
          <Text style={styles.stepBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.stepVal}>{value}</Text>
        <TouchableOpacity style={styles.stepBtn} onPress={onInc}>
          <Text style={styles.stepBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── 스타일 ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  // ① 컨텍스트 바
  contextBar: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  ctxBadge: {
    backgroundColor: COLORS.card, borderRadius: 8,
    paddingVertical: 3, paddingHorizontal: 8, alignItems: 'center',
  },
  ctxBadgeEditable: {
    borderWidth: 1, borderColor: COLORS.border,
  },
  ctxBadgeLocked: {
    opacity: 0.7,
  },
  ctxBadgeAlert: { borderWidth: 1, borderColor: COLORS.warning + '80' },
  ctxLabel: { fontSize: 9, color: COLORS.textDim },
  ctxValue: { fontSize: 12, color: COLORS.text, fontWeight: '600' },

  // ② 나무/과실
  sampleRow: {
    flexDirection: 'row', gap: 8, padding: 8,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  stepper: {
    flex: 1, backgroundColor: COLORS.card, borderRadius: 10,
    paddingVertical: 6, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  stepLabel: { fontSize: 10, color: COLORS.textMuted, marginBottom: 4 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: {
    backgroundColor: COLORS.surface, width: 30, height: 30,
    borderRadius: 15, alignItems: 'center', justifyContent: 'center',
  },
  stepBtnText: { color: COLORS.primary, fontSize: 18, fontWeight: 'bold' },
  stepVal: { color: COLORS.text, fontSize: 20, fontWeight: 'bold', minWidth: 28, textAlign: 'center' },

  // ③ 비교 테이블
  tableSection: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 8, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  tableRow: { flexDirection: 'row' },
  cell: { minWidth: 54, paddingHorizontal: 3, paddingVertical: 5, fontSize: 12, textAlign: 'center', color: COLORS.text },
  labelCell: { minWidth: 40, fontSize: 11 },
  headerCell: { color: COLORS.textMuted, fontWeight: '600', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  cellWrapper: { minWidth: 54, alignItems: 'center' },

  // ④ 음성 로그
  logSection: {
    flex: 1, backgroundColor: COLORS.surface,
    padding: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    minHeight: 80,
  },
  logEmpty: { color: COLORS.textDim, textAlign: 'center', marginTop: 8, fontSize: 12 },
  logRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 4 },
  logTime: { color: COLORS.textDim, fontSize: 9, minWidth: 50, marginTop: 2 },
  logMain: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },

  // ⑤ 하단 바
  bottomBar: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    flexDirection: 'row', alignItems: 'center',
    padding: 12, gap: 10,
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
  },
  corrBadge: {
    backgroundColor: COLORS.accent + '33', borderRadius: 8,
    paddingVertical: 6, paddingHorizontal: 10,
    borderWidth: 1, borderColor: COLORS.accent,
  },
  corrText: { color: COLORS.accent, fontSize: 12, fontWeight: '600' },
  manualBtn: {
    backgroundColor: COLORS.card, borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: COLORS.border,
  },
  manualBtnText: { color: COLORS.textMuted, fontSize: 13 },
  micBtn: {
    flex: 1, backgroundColor: COLORS.mic, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  micBtnActive: { backgroundColor: COLORS.micActive },
  micIcon: { fontSize: 24 },
  micLabel: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // 모달
  modalOverlay: { flex: 1, backgroundColor: '#000a', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, borderWidth: 1, borderColor: COLORS.border,
    paddingBottom: 40,
  },
  modalTitle: { color: COLORS.text, fontSize: 17, fontWeight: '700', marginBottom: 12 },
  chip: {
    backgroundColor: COLORS.card, borderRadius: 8,
    paddingVertical: 6, paddingHorizontal: 12, marginRight: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  chipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  textInput: {
    backgroundColor: COLORS.card, borderRadius: 10, color: COLORS.text,
    fontSize: 18, paddingVertical: 12, paddingHorizontal: 16,
    marginVertical: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  modalBtns: { flexDirection: 'row', gap: 10 },
  btnCancel: {
    flex: 1, backgroundColor: COLORS.card, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  btnConfirm: {
    flex: 2, backgroundColor: COLORS.primary, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
});
