import { create } from 'zustand';

import type { SessionContext, SurveyType } from '../types/domain';
import { formatLocalDate } from '../utils/date';

type SessionStore = SessionContext & {
  setObserver: (observer: string) => void;
  setFarmName: (farmName: string) => void;
  setLabel: (label: string) => void;
  setTreatment: (treatment: string) => void;
  cycleSurveyType: () => void;
  setSurveyType: (surveyType: SurveyType) => void;
  incrementTree: (delta: number) => void;
  incrementFruit: (delta: number) => void;
  setTreeNo: (treeNo: number) => void;
  setFruitNo: (fruitNo: number) => void;
  replaceContext: (context: Partial<SessionContext>) => void;
};

const SURVEY_TYPES: SurveyType[] = ['비대조사', '품질조사', '추가조사'];

export const useSessionStore = create<SessionStore>((set, get) => ({
  surveyDate: formatLocalDate(),
  observer: '',
  farmName: '',
  label: '',
  treatment: '',
  surveyType: '비대조사',
  treeNo: 1,
  fruitNo: 1,
  setObserver: (observer) => set({ observer }),
  setFarmName: (farmName) => set({ farmName }),
  setLabel: (label) => set({ label }),
  setTreatment: (treatment) => set({ treatment }),
  setSurveyType: (surveyType) => set({ surveyType }),
  cycleSurveyType: () => {
    const current = get().surveyType;
    const index = SURVEY_TYPES.indexOf(current);
    set({ surveyType: SURVEY_TYPES[(index + 1) % SURVEY_TYPES.length] });
  },
  incrementTree: (delta) => set((state) => ({ treeNo: Math.max(1, state.treeNo + delta) })),
  incrementFruit: (delta) => set((state) => ({ fruitNo: Math.max(1, state.fruitNo + delta) })),
  setTreeNo: (treeNo) => set({ treeNo: Math.max(1, treeNo) }),
  setFruitNo: (fruitNo) => set({ fruitNo: Math.max(1, fruitNo) }),
  replaceContext: (context) => set(context),
}));
