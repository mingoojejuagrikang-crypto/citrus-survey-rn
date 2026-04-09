export type SurveyType = '비대조사' | '품질조사' | '추가조사';

export type MeasurementItemName =
  | '횡경'
  | '종경'
  | '엽장'
  | '엽폭'
  | '과중'
  | '과피중'
  | '과피두께'
  | '과피두께x4'
  | '당도'
  | '적정'
  | '산함량'
  | '당산도'
  | '착색'
  | '비파괴';

export type ContextFieldName =
  | '나무'
  | '과실'
  | '농가'
  | '라벨'
  | '처리';

export type TextFieldName = '비고' | '병해충';

export type CommandName = '취소' | '수정';

export type ItemName = MeasurementItemName | ContextFieldName | TextFieldName;

export type ValueRange = {
  itemName: MeasurementItemName;
  minValue: number;
  maxValue: number;
  warningMessage: string;
};

export type CustomTerm = {
  id: string;
  alias: string;
  canonical: string;
  category: 'item' | 'pest' | 'context';
};

export type SessionContext = {
  surveyDate: string;
  observer: string;
  farmName: string;
  label: string;
  treatment: string;
  surveyType: SurveyType;
  treeNo: number;
  fruitNo: number;
};

export type ParsedMeasurementIntent = {
  kind: 'measurement';
  itemName: MeasurementItemName;
  value: number;
  rawText: string;
  normalizedText: string;
  action: 'create' | 'update';
};

export type ParsedContextIntent = {
  kind: 'context';
  fieldName: ContextFieldName;
  value: string | number;
  rawText: string;
  normalizedText: string;
};

export type ParsedTextIntent = {
  kind: 'text';
  fieldName: TextFieldName;
  value: string;
  rawText: string;
  normalizedText: string;
};

export type ParsedCommandIntent = {
  kind: 'command';
  commandName: CommandName;
  rawText: string;
  normalizedText: string;
};

export type ParsedUnknownIntent = {
  kind: 'unknown';
  rawText: string;
  normalizedText: string;
  reason: string;
};

export type ParsedIntent =
  | ParsedMeasurementIntent
  | ParsedContextIntent
  | ParsedTextIntent
  | ParsedCommandIntent
  | ParsedUnknownIntent;

export type MeasurementRecord = {
  itemName: ItemName;
  itemType: 'measurement' | 'text';
  numericValue: number | null;
  textValue: string | null;
  rawVoiceText: string;
  isOutOfRange: boolean;
  updatedAt: string;
};

export type SampleRow = SessionContext & {
  id: string;
  syncStatus: 0 | 1;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt: string | null;
};

export type SurveyRecordListItem = {
  id: string;
  surveyDate: string;
  farmName: string;
  label: string;
  treatment: string;
  surveyType: SurveyType;
  treeNo: number;
  fruitNo: number;
  syncStatus: 0 | 1;
  updatedAt: string;
};

export type ProgressSummary = {
  totalSamples: number;
  pendingSamples: number;
  syncedSamples: number;
  lastSyncedAt: string | null;
};

export type HistoryCacheRow = {
  surveyDate: string;
  farmName: string;
  label: string;
  treatment: string;
  treeNo: number;
  fruitNo: number;
  itemName: MeasurementItemName;
  value: number;
};

export type ComparisonRow = {
  itemName: MeasurementItemName;
  todayValue: number | null;
  historyValue: number | null;
  deltaPercent: number | null;
  severity: 'normal' | 'warning' | 'danger';
  isOutOfRange: boolean;
};

export type AppScriptSyncRow = {
  surveyDate: string;
  surveyType: SurveyType;
  farmName: string;
  label: string;
  treatment: string;
  treeNo: number;
  fruitNo: number;
  measurements: Record<string, string | number>;
  memo: string;
  observer: string;
};

export type SyncPayloadRow = {
  sampleId: string;
  surveyType: SurveyType;
  row: AppScriptSyncRow;
};
