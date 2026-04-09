import type {
  ContextFieldName,
  MeasurementItemName,
  SurveyType,
  TextFieldName,
  ValueRange,
} from '../types/domain';

export const MEASUREMENT_ITEM_LABELS: MeasurementItemName[] = [
  '횡경',
  '종경',
  '엽장',
  '엽폭',
  '과중',
  '과피중',
  '과피두께',
  '과피두께x4',
  '당도',
  '적정',
  '산함량',
  '당산도',
  '착색',
  '비파괴',
];

export const CONTEXT_FIELDS: ContextFieldName[] = ['나무', '과실', '농가', '라벨', '처리'];
export const TEXT_FIELDS: TextFieldName[] = ['비고', '병해충'];

export const SURVEY_TYPE_ITEMS: Record<SurveyType, MeasurementItemName[]> = {
  비대조사: ['횡경', '종경'],
  품질조사: [
    '횡경',
    '종경',
    '과중',
    '과피중',
    '과피두께x4',
    '과피두께',
    '당도',
    '적정',
    '산함량',
    '당산도',
    '착색',
    '비파괴',
  ],
  추가조사: [
    '횡경',
    '종경',
    '과중',
    '과피중',
    '과피두께x4',
    '과피두께',
    '당도',
    '적정',
    '산함량',
    '당산도',
    '착색',
    '비파괴',
  ],
};

export const ITEM_ALIASES: Record<MeasurementItemName, string[]> = {
  횡경: ['횡경', '행경', '횡 직경', '가로'],
  종경: ['종경', '종 직경', '세로'],
  엽장: ['엽장', '잎장'],
  엽폭: ['엽폭', '잎폭'],
  과중: ['과중', '과실중', '무게'],
  과피중: ['과피중', '껍질무게'],
  과피두께: ['과피두께', '껍질두께'],
  과피두께x4: ['과피두께x4', '과피두께4', '과피두께 곱하기 4', '과피두께 엑스포'],
  당도: ['당도'],
  적정: ['적정', '적정산'],
  산함량: ['산함량', '산 함량'],
  당산도: ['당산도', '당산 비'],
  착색: ['착색'],
  비파괴: ['비파괴', '비 파괴'],
};

export const CONTEXT_ALIASES: Record<ContextFieldName, string[]> = {
  나무: ['나무', '트리'],
  과실: ['과실', '과일'],
  농가: ['농가'],
  라벨: ['라벨'],
  처리: ['처리', '처리구'],
};

export const TEXT_ALIASES: Record<TextFieldName, string[]> = {
  비고: ['비고', '메모', '참고'],
  병해충: ['병해충', '병충해'],
};

export const DISEASE_TERMS = [
  '더뎅이병',
  '궤양병',
  '탄저병',
  '검은점무늬병',
  '녹응애',
  '응애',
  '진딧물',
  '총채벌레',
  '깍지벌레',
  '나방',
];

export const COMMAND_ALIASES = {
  취소: ['취소', '지워', '되돌려'],
  수정: ['수정', '정정', '바꿔'],
} as const;

export const DEFAULT_VALUE_RANGES: ValueRange[] = [
  { itemName: '횡경', minValue: 20, maxValue: 120, warningMessage: '횡경 범위를 확인하세요.' },
  { itemName: '종경', minValue: 20, maxValue: 120, warningMessage: '종경 범위를 확인하세요.' },
  { itemName: '엽장', minValue: 10, maxValue: 120, warningMessage: '엽장 범위를 확인하세요.' },
  { itemName: '엽폭', minValue: 5, maxValue: 80, warningMessage: '엽폭 범위를 확인하세요.' },
  { itemName: '과중', minValue: 10, maxValue: 500, warningMessage: '과중 범위를 확인하세요.' },
  { itemName: '과피중', minValue: 1, maxValue: 200, warningMessage: '과피중 범위를 확인하세요.' },
  { itemName: '과피두께', minValue: 0.1, maxValue: 20, warningMessage: '과피두께 범위를 확인하세요.' },
  { itemName: '과피두께x4', minValue: 1, maxValue: 80, warningMessage: '과피두께x4 범위를 확인하세요.' },
  { itemName: '당도', minValue: 1, maxValue: 20, warningMessage: '당도 범위를 확인하세요.' },
  { itemName: '적정', minValue: 0.1, maxValue: 20, warningMessage: '적정 범위를 확인하세요.' },
  { itemName: '산함량', minValue: 0.1, maxValue: 10, warningMessage: '산함량 범위를 확인하세요.' },
  { itemName: '당산도', minValue: 0.1, maxValue: 50, warningMessage: '당산도 범위를 확인하세요.' },
  { itemName: '착색', minValue: 0, maxValue: 10, warningMessage: '착색 범위를 확인하세요.' },
  { itemName: '비파괴', minValue: 0, maxValue: 100, warningMessage: '비파괴 범위를 확인하세요.' },
];
