import { useEffect } from 'react';

import { bootstrapApp } from '../services/app/bootstrapApp';
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
  const setLastFeedback = useSurveyStore((state) => state.setLastFeedback);
  const retryBootstrap = useSurveyStore((state) => state.retryBootstrap);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      try {
        const result = await bootstrapApp((progress) => {
          if (isMounted) {
            setModelDownloadProgress(progress);
          }
        });

        if (!isMounted) {
          return;
        }

        replaceContext({
          observer: result.observer,
        });
        setWebAppUrl(result.webAppUrl);
        setFarms(result.farms);
        setEnabledItems(result.enabledItems);
        setValueRanges(result.valueRanges);
        setCustomTerms(result.customTerms);
        setBootstrapState({ isBootstrapping: false, bootstrapError: null });
        if (result.modelReady) {
          setModelDownloadProgress(100);
          setVoiceStatus('ready');
        } else {
          setVoiceStatus('error');
          setBootstrapState({
            bootstrapError: result.modelError,
          });
          setLastFeedback(result.modelError ?? 'Whisper 모델 준비 실패');
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
    retryBootstrap,
    setBootstrapState,
    setCustomTerms,
    setEnabledItems,
    setFarms,
    setLastFeedback,
    setModelDownloadProgress,
    setValueRanges,
    setVoiceStatus,
    setWebAppUrl,
  ]);
}
