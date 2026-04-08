import { create } from 'zustand';
import { SurveyType } from '../utils/constants';

export interface SessionContext {
  observer: string;
  farmName: string;
  label: string;
  treatment: string;
  surveyType: SurveyType;
  treeNo: number;
  fruitNo: number;
  surveyDate: string;  // YYYY-MM-DD (오늘, 변경불가)
}

export interface CurrentMeasurements {
  [field: string]: number;
}

export interface VoiceLog {
  id: string;
  timestamp: string;
  rawText: string;
  parsedType: string;
  parsedField?: string;
  parsedValue?: number;
  success: boolean;
  outOfRange?: boolean;
}

interface SurveyState {
  // 세션 컨텍스트
  session: SessionContext;
  setSession: (updates: Partial<SessionContext>) => void;

  // 현재 샘플의 측정값 (화면 표시용)
  currentMeasurements: CurrentMeasurements;
  setCurrentMeasurements: (m: CurrentMeasurements) => void;
  updateMeasurement: (field: string, value: number) => void;

  // 현재 sample_id
  currentSampleId: string | null;
  setCurrentSampleId: (id: string | null) => void;

  // 수정 모드
  correctionMode: boolean;
  setCorrectionMode: (v: boolean) => void;

  // 음성 로그
  voiceLogs: VoiceLog[];
  addVoiceLog: (log: VoiceLog) => void;

  // 음성인식 상태
  isListening: boolean;
  setIsListening: (v: boolean) => void;

  // 미동기화 건수
  unsyncedCount: number;
  setUnsyncedCount: (n: number) => void;

  // 웹앱 URL
  webAppUrl: string;
  setWebAppUrl: (url: string) => void;

  // 농가 목록 (설정에서 관리)
  farmList: string[];
  setFarmList: (farms: string[]) => void;
}

const today = new Date();
const surveyDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

export const useSurveyStore = create<SurveyState>((set) => ({
  session: {
    observer: '',
    farmName: '',
    label: 'A',
    treatment: '시험',
    surveyType: '비대조사',
    treeNo: 1,
    fruitNo: 1,
    surveyDate,
  },
  setSession: (updates) =>
    set((state) => ({ session: { ...state.session, ...updates } })),

  currentMeasurements: {},
  setCurrentMeasurements: (m) => set({ currentMeasurements: m }),
  updateMeasurement: (field, value) =>
    set((state) => ({
      currentMeasurements: { ...state.currentMeasurements, [field]: value },
    })),

  currentSampleId: null,
  setCurrentSampleId: (id) => set({ currentSampleId: id }),

  correctionMode: false,
  setCorrectionMode: (v) => set({ correctionMode: v }),

  voiceLogs: [],
  addVoiceLog: (log) =>
    set((state) => ({
      voiceLogs: [log, ...state.voiceLogs].slice(0, 20),
    })),

  isListening: false,
  setIsListening: (v) => set({ isListening: v }),

  unsyncedCount: 0,
  setUnsyncedCount: (n) => set({ unsyncedCount: n }),

  webAppUrl: '',
  setWebAppUrl: (url) => set({ webAppUrl: url }),

  farmList: ['이원창', '강남호', '양승보'],
  setFarmList: (farms) => set({ farmList: farms }),
}));
