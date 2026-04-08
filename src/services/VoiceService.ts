import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
  type ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { CONTEXTUAL_STRINGS } from '../utils/constants';
import { parseBestAlternative, ParsedCommand } from './ParserService';

// ─── 권한 ─────────────────────────────────────────────────────────────────────

export async function requestPermissions(): Promise<boolean> {
  const speechPerm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  const audioPerm = await Audio.requestPermissionsAsync();
  return speechPerm.granted && audioPerm.granted;
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

// ─── 개별 발화 녹음 ───────────────────────────────────────────────────────────

const CLIPS_DIR = `${FileSystem.documentDirectory}clips/`;

export async function ensureClipsDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(CLIPS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CLIPS_DIR, { intermediates: true });
  }
}

let currentRecording: Audio.Recording | null = null;

export async function startClipRecording(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.LOW_QUALITY
    );
    currentRecording = recording;
  } catch (err) {
    console.warn('clip recording start error:', err);
  }
}

export async function stopClipRecording(): Promise<string | null> {
  if (!currentRecording) return null;
  try {
    await currentRecording.stopAndUnloadAsync();
    const uri = currentRecording.getURI();
    currentRecording = null;

    if (!uri) return null;

    await ensureClipsDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
    const destPath = `${CLIPS_DIR}clip_${timestamp}.m4a`;
    await FileSystem.moveAsync({ from: uri, to: destPath });

    // 3일 이상 된 클립 삭제
    await cleanOldClips();

    return destPath;
  } catch (err) {
    console.warn('clip recording stop error:', err);
    currentRecording = null;
    return null;
  }
}

async function cleanOldClips(): Promise<void> {
  try {
    const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000; // 3일
    const files = await FileSystem.readDirectoryAsync(CLIPS_DIR);
    for (const file of files) {
      const info = await FileSystem.getInfoAsync(`${CLIPS_DIR}${file}`, { md5: false });
      if (info.exists && info.modificationTime && info.modificationTime * 1000 < cutoff) {
        await FileSystem.deleteAsync(`${CLIPS_DIR}${file}`, { idempotent: true });
      }
    }
  } catch (err) {
    console.warn('cleanOldClips error:', err);
  }
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
