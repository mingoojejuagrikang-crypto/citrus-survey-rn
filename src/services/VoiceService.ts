import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
  type ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';
import { CONTEXTUAL_STRINGS } from '../utils/constants';
import { parseBestAlternative, ParsedCommand } from './ParserService';

// ─── 권한 ─────────────────────────────────────────────────────────────────────

export async function requestPermissions(): Promise<boolean> {
  const speechPerm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  return speechPerm.granted;
}

// ─── 음성인식 시작/중지 ────────────────────────────────────────────────────────

export function startRecognition() {
  ExpoSpeechRecognitionModule.start({
    lang: 'ko-KR',
    interimResults: false,
    maxAlternatives: 5,
    continuous: true,
    contextualStrings: CONTEXTUAL_STRINGS,
    requiresOnDeviceRecognition: false,
    addsPunctuation: false,
  });
}

export function stopRecognition() {
  ExpoSpeechRecognitionModule.stop();
}

export function abortRecognition() {
  ExpoSpeechRecognitionModule.abort();
}

// ─── 개별 발화 녹음 (stub — expo-av SDK 55 호환 대기 중) ──────────────────────
// expo-av는 SDK 55와 호환 문제로 임시 비활성화.
// 음성인식 자체는 정상 작동함.

export async function startClipRecording(): Promise<void> {
  // TODO: expo-av SDK 55 호환 버전 출시 후 활성화
}

export async function stopClipRecording(): Promise<string | null> {
  // TODO: expo-av SDK 55 호환 버전 출시 후 활성화
  return null;
}

// ─── 이벤트 훅 (컴포넌트에서 사용) ──────────────────────────────────────────

export { useSpeechRecognitionEvent };

export function parseRecognitionResult(event: ExpoSpeechRecognitionResultEvent): ParsedCommand {
  const alternatives = event.results?.[0]
    ? [event.results[0].transcript, ...(event.results.slice(1).map(r => r.transcript))]
    : [];
  if (alternatives.length === 0) {
    return { type: 'unknown', rawText: '', score: 0 };
  }
  return parseBestAlternative(alternatives);
}
