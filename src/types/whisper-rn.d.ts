declare module 'whisper.rn' {
  export type TranscribeResult = {
    result: string;
  };

  export type WhisperContext = {
    transcribe: (
      filePathOrBase64: string | number,
      options?: Record<string, unknown>
    ) => {
      stop: () => Promise<void>;
      promise: Promise<TranscribeResult>;
    };
    release: () => Promise<void>;
  };

  export function initWhisper(options: {
    filePath: string | number;
    useCoreMLIos?: boolean;
    useGpu?: boolean;
  }): Promise<WhisperContext>;
}
