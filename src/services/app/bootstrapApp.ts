import { SURVEY_TYPE_ITEMS } from '../../constants/items';
import { whisperService } from '../audio/WhisperService';
import { databaseService } from '../storage/DatabaseService';

type BootstrapResult = {
  observer: string;
  webAppUrl: string;
  farms: string[];
  enabledItems: typeof SURVEY_TYPE_ITEMS;
  modelReady: boolean;
  modelError: string | null;
  valueRanges: Awaited<ReturnType<typeof databaseService.getValueRanges>>;
  customTerms: Awaited<ReturnType<typeof databaseService.listCustomTerms>>;
};

function safeParseJson<T>(value: string | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function bootstrapApp(
  onModelProgress?: (progress: number) => void
): Promise<BootstrapResult> {
  await databaseService.initialize();
  const config = await databaseService.getConfigMap();
  const valueRanges = await databaseService.getValueRanges();
  const customTerms = await databaseService.listCustomTerms();

  let modelReady = false;
  let modelError: string | null = null;

  try {
    await whisperService.initializeContext(({ progress }) => {
      onModelProgress?.(progress);
    });
    modelReady = true;
  } catch (error) {
    modelError = error instanceof Error ? error.message : 'Whisper 모델 초기화에 실패했습니다.';
  }

  return {
    observer: config.observer ?? '',
    webAppUrl: config.webAppUrl ?? '',
    farms: safeParseJson<string[]>(config.farms, []),
    enabledItems: safeParseJson<typeof SURVEY_TYPE_ITEMS>(
      config.enabled_items,
      SURVEY_TYPE_ITEMS
    ),
    modelReady,
    modelError,
    valueRanges,
    customTerms,
  };
}
