import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
  type ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';
import { BASE_CONTEXTUAL_STRINGS } from '../utils/constants';
import { parseBestAlternative, ParsedToken } from './ParserService';
import { getCustomTerms } from './DatabaseService';

// ─── 권한 ─────────────────────────────────────────────────────────────────────

export async function requestPermissions(): Promise<boolean> {
  const speechPerm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  return speechPerm.granted;
}

// ─── contextualStrings 빌드 ────────────────────────────────────────────────────

export async function buildContextualStrings(): Promise<string[]> {
  try {
    const customTerms = await getCustomTerms();
    return [...BASE_CONTEXTUAL_STRINGS, ...customTerms];
  } catch {
    return [...BASE_CONTEXTUAL_STRINGS];
  }
}

// ─── 음성인식 시작/중지 ────────────────────────────────────────────────────────

export async function startRecognition(customStrings?: string[]): Promise<void> {
  const contextualStrings = customStrings ?? await buildContextualStrings();
  ExpoSpeechRecognitionModule.start({
    lang: 'ko-KR',
    interimResults: false,
    maxAlternatives: 5,
    continuous: true,
    contextualStrings,
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

export async function startClipRecording(): Promise<void> {
  // TODO: expo-av SDK 55 호환 버전 출시 후 활성화
}

export async function stopClipRecording(): Promise<string | null> {
  // TODO: expo-av SDK 55 호환 버전 출시 후 활성화
  return null;
}

// ─── 이벤트 훅 (컴포넌트에서 사용) ──────────────────────────────────────────

export { useSpeechRecognitionEvent };

export function parseRecognitionResult(event: ExpoSpeechRecognitionResultEvent): ParsedToken[] {
  const alternatives = event.results?.[0]
    ? [event.results[0].transcript, ...(event.results.slice(1).map(r => r.transcript))]
    : [];
  if (alternatives.length === 0) return [];
  return parseBestAlternative(alternatives);
}
