import { create } from 'zustand';

import { DEFAULT_FARMS, DEFAULT_WEB_APP_URL } from '../constants/app';
import { SURVEY_TYPE_ITEMS } from '../constants/items';
import type { CustomTerm, MeasurementItemName, SurveyType, ValueRange } from '../types/domain';

type SettingsStore = {
  webAppUrl: string;
  farms: string[];
  enabledItems: Record<SurveyType, MeasurementItemName[]>;
  valueRanges: ValueRange[];
  customTerms: CustomTerm[];
  setWebAppUrl: (webAppUrl: string) => void;
  setFarms: (farms: string[]) => void;
  setEnabledItems: (enabledItems: Record<SurveyType, MeasurementItemName[]>) => void;
  setValueRanges: (valueRanges: ValueRange[]) => void;
  setCustomTerms: (customTerms: CustomTerm[]) => void;
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  webAppUrl: DEFAULT_WEB_APP_URL,
  farms: DEFAULT_FARMS,
  enabledItems: SURVEY_TYPE_ITEMS,
  valueRanges: [],
  customTerms: [],
  setWebAppUrl: (webAppUrl) => set({ webAppUrl }),
  setFarms: (farms) => set({ farms }),
  setEnabledItems: (enabledItems) => set({ enabledItems }),
  setValueRanges: (valueRanges) => set({ valueRanges }),
  setCustomTerms: (customTerms) => set({ customTerms }),
}));
