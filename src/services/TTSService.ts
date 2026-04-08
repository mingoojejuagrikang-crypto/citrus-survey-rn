import Tts from 'react-native-tts';

let initialized = false;

async function init() {
  if (initialized) return;
  try {
    Tts.setDefaultLanguage('ko-KR');
    // setDefaultRate / setDefaultPitch은 일부 버전에서 타입 오류 발생 — 생략
    initialized = true;
  } catch (err) {
    // TTS 초기화 실패 시 무음으로 처리
    initialized = true;
  }
}

export async function speak(text: string): Promise<void> {
  try {
    await init();
    Tts.stop();
    Tts.speak(text);
  } catch (err) {
    // TTS 불가 시 무음 처리 (음성인식에는 영향 없음)
  }
}

export function stop() {
  try { Tts.stop(); } catch {}
}
