import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export interface CSVRow {
  surveyDate: string;
  surveyType: string;
  farmName: string;
  label: string;
  treatment: string;
  treeNo: number;
  fruitNo: number;
  measurements: Record<string, number | string>;
  memo: string;
  observer: string;
  syncStatus: number;
  createdAt: string;
}

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function exportToCSV(rows: CSVRow[]): Promise<void> {
  if (rows.length === 0) {
    throw new Error('내보낼 데이터가 없습니다.');
  }

  // 모든 측정 항목 키 수집
  const measurementKeys = new Set<string>();
  rows.forEach(row => {
    Object.keys(row.measurements).forEach(k => {
      if (k !== '비고') measurementKeys.add(k);
    });
  });
  const mKeys = Array.from(measurementKeys);

  const headers = [
    '조사일자', '조사유형', '농가명', '라벨', '처리구',
    '조사나무', '조사과실',
    ...mKeys,
    '비고', '조사자', '동기화상태', '생성시각',
  ];

  const csvLines: string[] = [headers.map(escapeCSV).join(',')];

  for (const row of rows) {
    const line = [
      row.surveyDate,
      row.surveyType,
      row.farmName,
      row.label,
      row.treatment,
      row.treeNo,
      row.fruitNo,
      ...mKeys.map(k => row.measurements[k] ?? ''),
      row.memo,
      row.observer,
      row.syncStatus === 1 ? '완료' : '미전송',
      row.createdAt,
    ].map(escapeCSV).join(',');
    csvLines.push(line);
  }

  const csvContent = '\uFEFF' + csvLines.join('\n'); // BOM for Excel
  const fileName = `citrus_survey_${new Date().toISOString().slice(0, 10)}.csv`;
  const filePath = `${FileSystem.documentDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(filePath, csvContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(filePath, {
      mimeType: 'text/csv',
      dialogTitle: '감귤 조사 데이터 내보내기',
    });
  } else {
    throw new Error('공유 기능을 사용할 수 없습니다.');
  }
}
