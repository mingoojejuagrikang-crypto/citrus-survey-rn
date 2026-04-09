import Tts from 'react-native-tts';

let initialized = false;

async function init() {
  if (initialized) return;
  try {
    Tts.setDefaultLanguage('ko-KR');
    initialized = true;
  } catch {
    initialized = true;
  }
}

// speak() — TTS 완료 시 resolve, 최대 5초 타임아웃
export async function speak(text: string): Promise<void> {
  try {
    await init();
    return new Promise<void>((resolve) => {
      // 이벤트가 오지 않아도 최대 5초 후 자동 해제
      const timer = setTimeout(resolve, 5000);
      const done = () => {
        clearTimeout(timer);
        Tts.removeEventListener('tts-finish', done);
        Tts.removeEventListener('tts-cancel', done);
        Tts.removeEventListener('tts-error', done);
        resolve();
      };
      Tts.addEventListener('tts-finish', done);
      Tts.addEventListener('tts-cancel', done);
      Tts.addEventListener('tts-error', done);
      Tts.stop();
      Tts.speak(text);
    });
  } catch {
    // TTS 불가 시 무음 처리
  }
}

export function stop() {
  try { Tts.stop(); } catch {}
}
