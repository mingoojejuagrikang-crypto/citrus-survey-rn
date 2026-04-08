import Tts from 'react-native-tts';

let initialized = false;

async function init() {
  if (initialized) return;
  try {
    await Tts.setDefaultLanguage('ko-KR');
    await Tts.setDefaultRate(0.5);
    await Tts.setDefaultPitch(1.0);
    initialized = true;
  } catch (err) {
    console.warn('TTS init error:', err);
  }
}

export async function speak(text: string): Promise<void> {
  try {
    await init();
    Tts.stop();
    Tts.speak(text);
  } catch (err) {
    console.warn('TTS speak error:', err);
  }
}

export function stop() {
  try { Tts.stop(); } catch {}
}
