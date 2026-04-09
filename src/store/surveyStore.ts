import { create } from 'zustand';

import type { ComparisonRow, ProgressSummary, SurveyRecordListItem } from '../types/domain';

export type VoiceStatus = 'idle' | 'model-loading' | 'ready' | 'recording' | 'processing' | 'error';

type SurveyStore = {
  isBootstrapping: boolean;
  bootstrapError: string | null;
  voiceStatus: VoiceStatus;
  modelDownloadProgress: number;
  liveTranscript: string;
  recentLogs: string[];
  comparisonRows: ComparisonRow[];
  records: SurveyRecordListItem[];
  progressSummary: ProgressSummary;
  lastFeedback: string;
  lastSyncMessage: string;
  setBootstrapState: (state: { isBootstrapping?: boolean; bootstrapError?: string | null }) => void;
  setVoiceStatus: (voiceStatus: VoiceStatus) => void;
  setModelDownloadProgress: (progress: number) => void;
  setLiveTranscript: (liveTranscript: string) => void;
  setRecentLogs: (recentLogs: string[]) => void;
  setComparisonRows: (comparisonRows: ComparisonRow[]) => void;
  setRecords: (records: SurveyRecordListItem[]) => void;
  setProgressSummary: (progressSummary: ProgressSummary) => void;
  setLastFeedback: (lastFeedback: string) => void;
  setLastSyncMessage: (lastSyncMessage: string) => void;
};

export const useSurveyStore = create<SurveyStore>((set) => ({
  isBootstrapping: true,
  bootstrapError: null,
  voiceStatus: 'idle',
  modelDownloadProgress: 0,
  liveTranscript: '',
  recentLogs: [],
  comparisonRows: [],
  records: [],
  progressSummary: {
    totalSamples: 0,
    pendingSamples: 0,
    syncedSamples: 0,
    lastSyncedAt: null,
  },
  lastFeedback: '',
  lastSyncMessage: '',
  setBootstrapState: (state) =>
    set((current) => ({
      isBootstrapping: state.isBootstrapping ?? current.isBootstrapping,
      bootstrapError: state.bootstrapError ?? current.bootstrapError,
    })),
  setVoiceStatus: (voiceStatus) => set({ voiceStatus }),
  setModelDownloadProgress: (modelDownloadProgress) => set({ modelDownloadProgress }),
  setLiveTranscript: (liveTranscript) => set({ liveTranscript }),
  setRecentLogs: (recentLogs) => set({ recentLogs }),
  setComparisonRows: (comparisonRows) => set({ comparisonRows }),
  setRecords: (records) => set({ records }),
  setProgressSummary: (progressSummary) => set({ progressSummary }),
  setLastFeedback: (lastFeedback) => set({ lastFeedback }),
  setLastSyncMessage: (lastSyncMessage) => set({ lastSyncMessage }),
}));
