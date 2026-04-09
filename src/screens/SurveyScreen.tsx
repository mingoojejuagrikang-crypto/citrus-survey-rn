import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { ActionButton } from '../components/ActionButton';
import { ComparisonTable } from '../components/ComparisonTable';
import { ContextModal } from '../components/ContextModal';
import { NumericStepper } from '../components/NumericStepper';
import { Panel } from '../components/Panel';
import { colors } from '../constants/theme';
import { parseSingle } from '../services/parser/ParserService';
import { ttsService } from '../services/audio/TtsService';
import { whisperService } from '../services/audio/WhisperService';
import { databaseService } from '../services/storage/DatabaseService';
import { useSessionStore } from '../store/sessionStore';
import { useSettingsStore } from '../store/settingsStore';
import { useSurveyStore } from '../store/surveyStore';

type EditorKey = 'farmName' | 'label' | 'treatment' | null;

export function SurveyScreen() {
  const session = useSessionStore();
  const enabledItems = useSettingsStore((state) => state.enabledItems[session.surveyType]);
  const customTerms = useSettingsStore((state) => state.customTerms);
  const valueRanges = useSettingsStore((state) => state.valueRanges);
  const webAppUrl = useSettingsStore((state) => state.webAppUrl);
  const voiceStatus = useSurveyStore((state) => state.voiceStatus);
  const modelDownloadProgress = useSurveyStore((state) => state.modelDownloadProgress);
  const liveTranscript = useSurveyStore((state) => state.liveTranscript);
  const recentLogs = useSurveyStore((state) => state.recentLogs);
  const comparisonRows = useSurveyStore((state) => state.comparisonRows);
  const lastFeedback = useSurveyStore((state) => state.lastFeedback);
  const setVoiceStatus = useSurveyStore((state) => state.setVoiceStatus);
  const setLiveTranscript = useSurveyStore((state) => state.setLiveTranscript);
  const setRecentLogs = useSurveyStore((state) => state.setRecentLogs);
  const setComparisonRows = useSurveyStore((state) => state.setComparisonRows);
  const setProgressSummary = useSurveyStore((state) => state.setProgressSummary);
  const setLastFeedback = useSurveyStore((state) => state.setLastFeedback);
  const [editorKey, setEditorKey] = useState<EditorKey>(null);
  const isLoopActiveRef = useRef(false);

  const refreshPanels = useCallback(async () => {
    const [logs, rows, summary] = await Promise.all([
      databaseService.listRecentVoiceLogs(),
      databaseService.getComparisonRows(session, enabledItems),
      databaseService.getProgressSummary(),
    ]);
    setRecentLogs(logs);
    setComparisonRows(rows);
    setProgressSummary(summary);
  }, [enabledItems, session, setComparisonRows, setProgressSummary, setRecentLogs]);

  useFocusEffect(
    useCallback(() => {
      void refreshPanels();
    }, [refreshPanels])
  );

  const validateBeforeStart = useCallback(() => {
    if (!session.observer) {
      Alert.alert('설정 필요', '조사자를 먼저 설정하세요.');
      return false;
    }
    if (!session.farmName) {
      Alert.alert('설정 필요', '농가명을 먼저 입력하세요.');
      return false;
    }
    if (!session.surveyType) {
      Alert.alert('설정 필요', '조사 유형을 먼저 선택하세요.');
      return false;
    }
    if (!webAppUrl) {
      Alert.alert('설정 필요', 'Apps Script URL을 먼저 설정하세요.');
      return false;
    }
    return true;
  }, [session.farmName, session.observer, session.surveyType, webAppUrl]);

  const stopLoop = useCallback(async () => {
    isLoopActiveRef.current = false;
    setVoiceStatus('ready');
    await ttsService.speak('음성입력 종료').catch(() => undefined);
  }, [setVoiceStatus]);

  const processTranscript = useCallback(
    async (transcript: string) => {
      setLiveTranscript(transcript);
      const parsed = parseSingle(transcript, customTerms);
      if (parsed.kind === 'command' && parsed.commandName === '취소') {
        const undone = await databaseService.undoLatest();
        const feedback = undone ? '취소' : '취소할 항목이 없습니다';
        setLastFeedback(feedback);
        await refreshPanels();
        await ttsService.speak(feedback);
        return;
      }

      if (parsed.kind === 'context') {
        if (parsed.fieldName === '나무') {
          session.setTreeNo(Number(parsed.value) || session.treeNo);
        } else if (parsed.fieldName === '과실') {
          session.setFruitNo(Number(parsed.value) || session.fruitNo);
        } else if (parsed.fieldName === '농가') {
          session.setFarmName(String(parsed.value));
        } else if (parsed.fieldName === '라벨') {
          session.setLabel(String(parsed.value));
        } else if (parsed.fieldName === '처리') {
          session.setTreatment(String(parsed.value));
        }
        const feedback = `${parsed.fieldName} ${parsed.value}`;
        setLastFeedback(feedback);
        await refreshPanels();
        await ttsService.speak(feedback);
        return;
      }

      if (parsed.kind === 'measurement' || parsed.kind === 'text') {
        await databaseService.saveParsedIntent(parsed, session, valueRanges);
        const feedback =
          parsed.kind === 'measurement'
            ? `${parsed.itemName} ${parsed.value} 확인`
            : `${parsed.fieldName} 저장`;
        setLastFeedback(feedback);
        await refreshPanels();
        await ttsService.speak(feedback);
        return;
      }

      const feedback = parsed.kind === 'unknown' ? parsed.reason : '처리하지 못했습니다.';
      setLastFeedback(feedback);
      await ttsService.speak(feedback);
    },
    [customTerms, refreshPanels, session, setLastFeedback, setLiveTranscript, valueRanges]
  );

  const startLoop = useCallback(async () => {
    if (!validateBeforeStart()) {
      return;
    }

    isLoopActiveRef.current = true;
    setVoiceStatus('recording');
    await ttsService.speak('음성입력 시작').catch(() => undefined);

    while (isLoopActiveRef.current) {
      try {
        setVoiceStatus('recording');
        const audioFilePath = await whisperService.recordUntilSilence();
        if (!isLoopActiveRef.current) {
          break;
        }
        setVoiceStatus('processing');
        const transcript = await whisperService.transcribe(audioFilePath);
        if (!transcript) {
          await ttsService.speak('인식 결과가 없습니다');
          setVoiceStatus('recording');
          continue;
        }
        await processTranscript(transcript);
        setVoiceStatus('recording');
      } catch (error) {
        const message = error instanceof Error ? error.message : '음성 처리 중 오류가 발생했습니다.';
        setLastFeedback(message);
        setVoiceStatus('error');
        await ttsService.speak(message).catch(() => undefined);
        break;
      }
    }

    if (!isLoopActiveRef.current) {
      setVoiceStatus('ready');
    }
  }, [processTranscript, setLastFeedback, setVoiceStatus, validateBeforeStart]);

  const handleManualInput = useCallback(() => {
    Alert.prompt(
      '수동 입력',
      '예: 횡경 52.3',
      [
        { style: 'cancel', text: '취소' },
        {
          text: '저장',
          onPress: (value?: string) => {
            if (!value) {
              return;
            }
            void processTranscript(value);
          },
        },
      ],
      'plain-text'
    );
  }, [processTranscript]);

  const editorConfig = useMemo(() => {
    if (!editorKey) {
      return null;
    }
    return {
      farmName: { title: '농가명 입력', value: session.farmName, save: session.setFarmName },
      label: { title: '라벨 입력', value: session.label, save: session.setLabel },
      treatment: { title: '처리구 입력', value: session.treatment, save: session.setTreatment },
    }[editorKey];
  }, [editorKey, session.farmName, session.label, session.setFarmName, session.setLabel, session.setTreatment, session.treatment]);

  return (
    <View style={styles.screen}>
      <Panel style={styles.contextBar}>
        <View style={styles.contextRow}>
          <Pressable onPress={() => setEditorKey('farmName')} style={styles.contextChip}>
            <Text style={styles.contextLabel}>농가</Text>
            <Text style={styles.contextValue}>{session.farmName || '미설정'}</Text>
          </Pressable>
          <Pressable onPress={() => setEditorKey('label')} style={styles.contextChip}>
            <Text style={styles.contextLabel}>라벨</Text>
            <Text style={styles.contextValue}>{session.label || '-'}</Text>
          </Pressable>
          <Pressable onPress={() => setEditorKey('treatment')} style={styles.contextChip}>
            <Text style={styles.contextLabel}>처리</Text>
            <Text style={styles.contextValue}>{session.treatment || '-'}</Text>
          </Pressable>
          <Pressable onPress={session.cycleSurveyType} style={styles.contextChip}>
            <Text style={styles.contextLabel}>유형</Text>
            <Text style={styles.contextValue}>{session.surveyType}</Text>
          </Pressable>
        </View>
        <View style={styles.contextRow}>
          <Text style={styles.observer}>조사자 {session.observer || '미설정'}</Text>
          <Text style={styles.observer}>날짜 {session.surveyDate}</Text>
        </View>
        <Text style={styles.helperText}>
          첫 테스트는 설정 탭에서 조사자와 농가를 저장한 뒤, 여기서 `수동 입력`으로 `횡경 52.3`처럼 넣으면 됩니다.
        </Text>
      </Panel>

      <View style={styles.stepperRow}>
        <NumericStepper label="조사 나무" onChange={session.incrementTree} value={session.treeNo} />
        <NumericStepper label="조사 과실" onChange={session.incrementFruit} value={session.fruitNo} />
      </View>

      <Panel style={styles.tablePanel}>
        <Text style={styles.sectionTitle}>오늘값 / 과거값 비교</Text>
        <ComparisonTable rows={comparisonRows} />
      </Panel>

      <View style={styles.bottomHalf}>
        <Panel style={styles.transcriptPanel}>
          <Text style={styles.sectionTitle}>실시간 인식 텍스트</Text>
          <Text style={styles.transcript}>{liveTranscript || '대기 중'}</Text>
          <Text style={styles.feedback}>{lastFeedback || '안내 없음'}</Text>
          {voiceStatus === 'model-loading' ? (
            <Text style={styles.progress}>모델 준비 중 {modelDownloadProgress}%</Text>
          ) : null}
        </Panel>

        <Panel style={styles.logPanel}>
          <Text style={styles.sectionTitle}>최근 음성 로그</Text>
          {recentLogs.length === 0 ? <Text style={styles.logItem}>아직 기록이 없습니다.</Text> : null}
          {recentLogs.map((log) => (
            <Text key={log} numberOfLines={1} style={styles.logItem}>
              {log}
            </Text>
          ))}
        </Panel>
      </View>

      <View style={styles.actionRow}>
        <ActionButton label="수동 입력" onPress={handleManualInput} variant="secondary" />
        <ActionButton
          disabled={voiceStatus === 'model-loading'}
          label={
            voiceStatus === 'recording' || voiceStatus === 'processing'
              ? '음성 중지'
              : voiceStatus === 'model-loading'
                ? `모델 준비 ${modelDownloadProgress}%`
                : '음성 시작'
          }
          onPress={() => {
            if (voiceStatus === 'recording' || voiceStatus === 'processing') {
              void stopLoop();
            } else {
              void startLoop();
            }
          }}
          variant={voiceStatus === 'recording' || voiceStatus === 'processing' ? 'danger' : 'primary'}
        />
      </View>

      {editorConfig ? (
        <ContextModal
          initialValue={editorConfig.value}
          onClose={() => setEditorKey(null)}
          onSubmit={editorConfig.save}
          title={editorConfig.title}
          visible={Boolean(editorConfig)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.bg,
    flex: 1,
    gap: 10,
    padding: 12,
  },
  contextBar: {
    gap: 10,
  },
  contextRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  contextChip: {
    backgroundColor: colors.chip,
    borderRadius: 14,
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  contextLabel: {
    color: colors.subtext,
    fontSize: 12,
  },
  contextValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  observer: {
    color: colors.subtext,
    fontSize: 13,
  },
  helperText: {
    color: colors.info,
    fontSize: 12,
    lineHeight: 17,
  },
  stepperRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tablePanel: {
    flex: 1.2,
    gap: 10,
  },
  bottomHalf: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  transcriptPanel: {
    flex: 1.2,
    gap: 8,
  },
  logPanel: {
    flex: 0.9,
    gap: 8,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  transcript: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  feedback: {
    color: colors.warning,
    fontSize: 14,
  },
  progress: {
    color: colors.info,
    fontSize: 13,
  },
  logItem: {
    color: colors.subtext,
    fontSize: 13,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
});
