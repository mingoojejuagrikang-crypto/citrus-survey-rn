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

// speak() — TTS 완료 시 resolve되는 Promise 반환
export async function speak(text: string): Promise<void> {
  try {
    await init();
    return new Promise<void>((resolve) => {
      const onFinish = () => {
        Tts.removeEventListener('tts-finish', onFinish);
        Tts.removeEventListener('tts-cancel', onFinish);
        Tts.removeEventListener('tts-error', onFinish);
        resolve();
      };
      Tts.addEventListener('tts-finish', onFinish);
      Tts.addEventListener('tts-cancel', onFinish);
      Tts.addEventListener('tts-error', onFinish);
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
