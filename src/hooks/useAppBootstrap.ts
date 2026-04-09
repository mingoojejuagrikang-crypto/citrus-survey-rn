import { useEffect } from 'react';

import { databaseService } from '../services/storage/DatabaseService';
import { whisperService } from '../services/audio/WhisperService';
import { useSessionStore } from '../store/sessionStore';
import { useSettingsStore } from '../store/settingsStore';
import { useSurveyStore } from '../store/surveyStore';

export function useAppBootstrap() {
  const replaceContext = useSessionStore((state) => state.replaceContext);
  const setWebAppUrl = useSettingsStore((state) => state.setWebAppUrl);
  const setFarms = useSettingsStore((state) => state.setFarms);
  const setEnabledItems = useSettingsStore((state) => state.setEnabledItems);
  const setValueRanges = useSettingsStore((state) => state.setValueRanges);
  const setCustomTerms = useSettingsStore((state) => state.setCustomTerms);
  const setBootstrapState = useSurveyStore((state) => state.setBootstrapState);
  const setVoiceStatus = useSurveyStore((state) => state.setVoiceStatus);
  const setModelDownloadProgress = useSurveyStore((state) => state.setModelDownloadProgress);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      try {
        await databaseService.initialize();
        const config = await databaseService.getConfigMap();
        const ranges = await databaseService.getValueRanges();
        const customTerms = await databaseService.listCustomTerms();

        if (!isMounted) {
          return;
        }

        replaceContext({
          observer: config.observer ?? '',
        });
        setWebAppUrl(config.webAppUrl ?? '');
        setFarms(JSON.parse(config.farms ?? '[]') as string[]);
        setEnabledItems(
          JSON.parse(config.enabled_items ?? '{}') as ReturnType<typeof useSettingsStore.getState>['enabledItems']
        );
        setValueRanges(ranges);
        setCustomTerms(customTerms);
        setBootstrapState({ isBootstrapping: false, bootstrapError: null });
        setVoiceStatus('model-loading');

        try {
          await whisperService.initializeContext(({ progress }) => {
            if (isMounted) {
              setModelDownloadProgress(progress);
            }
          });
          if (isMounted) {
            setModelDownloadProgress(100);
            setVoiceStatus('ready');
          }
        } catch (error) {
          if (isMounted) {
            setVoiceStatus('error');
            setBootstrapState({
              bootstrapError:
                error instanceof Error ? error.message : 'Whisper 모델 초기화에 실패했습니다.',
            });
          }
        }
      } catch (error) {
        if (isMounted) {
          setBootstrapState({
            isBootstrapping: false,
            bootstrapError: error instanceof Error ? error.message : '앱 초기화에 실패했습니다.',
          });
        }
      }
    };

    void run();

    return () => {
      isMounted = false;
    };
  }, [
    replaceContext,
    setBootstrapState,
    setCustomTerms,
    setEnabledItems,
    setFarms,
    setModelDownloadProgress,
    setValueRanges,
    setVoiceStatus,
    setWebAppUrl,
  ]);
}
