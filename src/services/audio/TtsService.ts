import Tts from 'react-native-tts';

class TtsService {
  private initialized = false;
  private activeUtterance: Promise<void> | null = null;

  async initialize() {
    if (this.initialized) {
      return;
    }

    await Tts.setDefaultLanguage('ko-KR');
    Tts.setDefaultRate(0.48);
    Tts.setDefaultPitch(1.0);
    Tts.setIgnoreSilentSwitch('ignore');
    this.initialized = true;
  }

  async speak(text: string, timeoutMs = 8000) {
    await this.initialize();
    await Tts.stop();

    const utterance = new Promise<void>((resolve, reject) => {
      let finished = false;
      const handleFinish = () => {
        if (finished) {
          return;
        }
        finished = true;
        clearTimeout(timeoutId);
        Tts.removeEventListener('tts-finish', handleFinish);
        Tts.removeEventListener('tts-cancel', handleCancel);
      };
      const handleCancel = () => {
        handleFinish();
        reject(new Error('TTS cancelled'));
      };

      const timeoutId = setTimeout(() => {
        handleFinish();
        reject(new Error('TTS timeout'));
      }, timeoutMs);

      Tts.addEventListener('tts-finish', () => {
        handleFinish();
        resolve();
      });
      Tts.addEventListener('tts-cancel', handleCancel);

      void Tts.speak(text);
    });

    this.activeUtterance = utterance;
    return utterance;
  }

  async stop() {
    this.activeUtterance = null;
    await Tts.stop();
  }
}

export const ttsService = new TtsService();
