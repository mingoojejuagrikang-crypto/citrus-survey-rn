import type { SurveyType } from '../types/domain';

export const DEFAULT_WEB_APP_URL =
  'https://script.google.com/macros/s/AKfycbyGayON8Uykgzb8H_sozo5ngvLG-39znIWJrcyuvxKoHspx_ADScgOSoBTLzl4CtWnE/exec';

export const GOOGLE_SHEETS_ID = '1_d5L8jI583LN1n6rJ1H8_mPcsKMgEiYnYXhS_JOppDU';

export const DEFAULT_FARMS = ['이원창', '강남호', '양승보'];

export const MODEL_FILE_NAME = 'ggml-base.bin';
export const MODEL_URL =
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin';
export const MODEL_DIRECTORY = 'whisper';

export const SURVEY_TYPE_ORDER: SurveyType[] = ['비대조사', '품질조사', '추가조사'];

export const REQUIRED_SETTINGS_KEYS = [
  'observer',
  'farmName',
  'surveyType',
  'webAppUrl',
] as const;
