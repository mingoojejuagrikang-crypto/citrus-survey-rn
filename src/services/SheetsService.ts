export interface SheetsRow {
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
}

export async function syncToSheets(webAppUrl: string, rows: SheetsRow[]): Promise<{ status: string; count: number }> {
  const response = await fetch(webAppUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

export async function downloadHistory(
  webAppUrl: string,
  year: string,
  farmName: string
): Promise<Record<string, Record<string, unknown>[]>> {
  const url = `${webAppUrl}?year=${encodeURIComponent(year)}&farm=${encodeURIComponent(farmName)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}
