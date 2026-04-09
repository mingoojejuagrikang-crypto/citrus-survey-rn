import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { initWhisper, type WhisperContext } from 'whisper.rn';

import {
  MODEL_DIRECTORY,
  MODEL_FILE_NAME,
  MODEL_URL,
} from '../../constants/app';

type DownloadProgress = {
  progress: number;
};

class WhisperService {
  private context: WhisperContext | null = null;
  private modelPath: string | null = null;

  private async getModelPath() {
    if (this.modelPath) {
      return this.modelPath;
    }
    const baseDir = `${FileSystem.documentDirectory ?? ''}${MODEL_DIRECTORY}`;
    await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });
    this.modelPath = `${baseDir}/${MODEL_FILE_NAME}`;
    return this.modelPath;
  }

  async getModelStatus() {
    const modelPath = await this.getModelPath();
    const info = await FileSystem.getInfoAsync(modelPath);
    return {
      exists: info.exists,
      path: modelPath,
    };
  }

  async ensureModel(onProgress?: (state: DownloadProgress) => void) {
    const modelPath = await this.getModelPath();
    const info = await FileSystem.getInfoAsync(modelPath);
    if (info.exists) {
      return modelPath;
    }

    const download = FileSystem.createDownloadResumable(
      MODEL_URL,
      modelPath,
      {},
      (progress) => {
        const ratio =
          progress.totalBytesExpectedToWrite > 0
            ? progress.totalBytesWritten / progress.totalBytesExpectedToWrite
            : 0;
        onProgress?.({ progress: Math.round(ratio * 100) });
      }
    );
    await download.downloadAsync();
    return modelPath;
  }

  async initializeContext(onProgress?: (state: DownloadProgress) => void) {
    const modelPath = await this.ensureModel(onProgress);
    if (!this.context) {
      this.context = await initWhisper({
        filePath: modelPath,
        useCoreMLIos: true,
        useGpu: true,
      });
    }
    return this.context;
  }

  async ensureRecordingPermission() {
    const permission = await Audio.requestPermissionsAsync();
    return permission.granted;
  }

  async prepareAudioSession() {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });
  }

  async recordUntilSilence(maxDurationMs = 10000, silenceMs = 1500) {
    await this.prepareAudioSession();
    const granted = await this.ensureRecordingPermission();
    if (!granted) {
      throw new Error('마이크 권한이 거부되었습니다.');
    }

    const recording = new Audio.Recording();
    const options = {
      ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
      isMeteringEnabled: true,
    };
    await recording.prepareToRecordAsync(options);
    await recording.startAsync();

    const startedAt = Date.now();
    let quietStartedAt = Date.now();

    while (Date.now() - startedAt < maxDurationMs) {
      const status = await recording.getStatusAsync();
      const metering = 'metering' in status && typeof status.metering === 'number' ? status.metering : -160;
      if (metering < -45) {
        if (Date.now() - quietStartedAt >= silenceMs) {
          break;
        }
      } else {
        quietStartedAt = Date.now();
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    if (!uri) {
      throw new Error('녹음 파일을 생성하지 못했습니다.');
    }

    return uri;
  }

  async transcribe(audioFilePath: string) {
    const context = await this.initializeContext();
    const job = context.transcribe(audioFilePath, {
      language: 'ko',
      temperature: 0,
      translate: false,
    });
    const result = await job.promise;
    return result.result.trim();
  }
}

export const whisperService = new WhisperService();
