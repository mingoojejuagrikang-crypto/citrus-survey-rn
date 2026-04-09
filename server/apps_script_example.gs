const SHEET_ID = '1_d5L8jI583LN1n6rJ1H8_mPcsKMgEiYnYXhS_JOppDU';

function jsonOutput(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function doGet(e) {
  const year = String((e && e.parameter && e.parameter.year) || '').trim();
  const farm = String((e && e.parameter && e.parameter.farm) || '').trim();

  if (!year || !farm) {
    return jsonOutput({ status: 'error', message: 'year와 farm 파라미터 필요' });
  }

  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  const sheetNames = ['비대조사', '품질조사', '추가조사'];
  const data = {};

  sheetNames.forEach((sheetName) => {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      return;
    }

    const rows = sheet.getDataRange().getValues();
    if (rows.length < 2) {
      data[sheetName] = [];
      return;
    }

    const headers = rows[0];
    data[sheetName] = rows
      .slice(1)
      .map((row) => headers.reduce((acc, header, index) => {
        acc[header] = row[index];
        return acc;
      }, {}))
      .filter((row) => {
        const surveyDate = String(row['조사일자'] || '');
        const farmName = String(row['농가명'] || '');
        return surveyDate.indexOf(year) === 0 && farmName === farm;
      });
  });

  return jsonOutput({ status: 'ok', data: data });
}

function doPost(e) {
  try {
    const requestBody = parseRequestBody_(e);
    if (requestBody.action !== 'upsertSamples') {
      return jsonOutput({ status: 'error', message: '지원하지 않는 action' });
    }

    const rows = Array.isArray(requestBody.rows) ? requestBody.rows : [];
    const spreadsheet = SpreadsheetApp.openById(requestBody.sheetId || SHEET_ID);

    rows.forEach((entry) => {
      upsertRow_(spreadsheet, entry.sheetName, entry.values || {});
    });

    return jsonOutput({ status: 'ok', success: true, count: rows.length });
  } catch (error) {
    return jsonOutput({
      status: 'error',
      message: error && error.message ? error.message : 'doPost 처리 실패',
    });
  }
}

function parseRequestBody_(e) {
  const raw = e && e.postData && e.postData.contents ? e.postData.contents : '';
  const type = e && e.postData && e.postData.type ? e.postData.type : '';

  if (type.indexOf('application/json') === 0 && raw) {
    return JSON.parse(raw);
  }

  const parameter = (e && e.parameter) || {};
  return {
    action: parameter.action,
    sheetId: parameter.sheetId,
    rows: parameter.rows ? JSON.parse(parameter.rows) : [],
  };
}

function upsertRow_(spreadsheet, sheetName, values) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('시트를 찾을 수 없습니다: ' + sheetName);
  }

  const headers = sheet.getDataRange().getValues()[0];
  const keyHeaders = ['조사일자', '농가명', '라벨', '처리구', '조사나무', '조사과실'];
  const key = keyHeaders.map((header) => String(values[header] || '')).join('||');

  const rows = sheet.getDataRange().getValues();
  let targetRow = -1;
  for (let i = 1; i < rows.length; i += 1) {
    const rowKey = keyHeaders
      .map((header) => {
        const index = headers.indexOf(header);
        return String(index >= 0 ? rows[i][index] : '');
      })
      .join('||');
    if (rowKey === key) {
      targetRow = i + 1;
      break;
    }
  }

  const nextRow = headers.map((header) => values[header] !== undefined ? values[header] : '');
  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, headers.length).setValues([nextRow]);
  } else {
    sheet.appendRow(nextRow);
  }
}
