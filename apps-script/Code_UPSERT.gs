// ═══════════════════════════════════════════════════════════════════
// 감귤 생육조사 앱 — Google Apps Script (UPSERT 버전)
//
// 기존 Code.gs (APPEND) 대신 이 파일을 사용하면:
//   - 같은 조사일+농가+라벨+처리+나무+과실 = 기존 행 UPDATE
//   - 신규 = INSERT (appendRow)
//
// 설치 방법:
//   1. Google Sheets → 확장 프로그램 → Apps Script
//   2. 이 파일 내용을 붙여넣기 (기존 Code.gs 대체)
//   3. SPREADSHEET_ID를 실제 시트 ID로 변경
//   4. 배포 → 웹 앱으로 배포 (기존 배포 URL 업데이트)
// ═══════════════════════════════════════════════════════════════════

var SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';

// 헤더 정의
var HEADERS = {
  '비대조사': ['조사일자', '농가명', '라벨', '처리', '조사나무', '조사과실', '횡경', '종경', '비고', '조사자'],
  '품질조사': ['조사일자', '농가명', '라벨', '처리', '조사나무', '조사과실', '횡경', '종경', '과중', '과피중', '과피두께x4', '과피두께', '당도', '적정', '산함량', '당산도', '착색', '비파괴', '비고', '조사자'],
};

// UPSERT 키 컬럼 (이 조합이 같으면 UPDATE)
var KEY_COLS = ['조사일자', '농가명', '라벨', '처리', '조사나무', '조사과실'];
var META_COLS = ['비고', '조사자'];

// ── doPost: UPSERT 처리 ──────────────────────────────────────────────

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var rows = data.rows || [data];
    var inserted = 0;
    var updated = 0;

    rows.forEach(function(row) {
      var sheetName = row.surveyType || '비대조사';
      var sheet = getOrCreateSheet(ss, sheetName);
      var headers = getHeaders(sheet);

      // 새 측정 항목이 있으면 헤더 추가
      var measurements = row.measurements || {};
      Object.keys(measurements).forEach(function(key) {
        if (headers.indexOf(key) === -1 && META_COLS.indexOf(key) === -1) {
          var insertAt = headers.indexOf('비고');
          if (insertAt === -1) insertAt = headers.length;
          sheet.insertColumnBefore(insertAt + 1);
          sheet.getRange(1, insertAt + 1).setValue(key);
          headers.splice(insertAt, 0, key);
        }
      });

      // 행 데이터 구성
      var newRow = buildRow(headers, row, measurements);

      // UPSERT: 기존 행 찾기
      var existingRowIdx = findExistingRow(sheet, headers, row);
      if (existingRowIdx > 0) {
        // UPDATE
        sheet.getRange(existingRowIdx, 1, 1, newRow.length).setValues([newRow]);
        updated++;
      } else {
        // INSERT
        sheet.appendRow(newRow);
        inserted++;
      }
    });

    return ContentService.createTextOutput(
      JSON.stringify({ status: 'ok', inserted: inserted, updated: updated, count: inserted + updated })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', message: err.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// ── doGet: 과거 데이터 조회 (년도+농가명 기준) ──────────────────────

function doGet(e) {
  try {
    var year = e.parameter.year;
    var farmName = e.parameter.farm;

    if (!year || !farmName) {
      return ContentService.createTextOutput(
        JSON.stringify({ status: 'error', message: 'year and farm params required' })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var result = {};

    ss.getSheets().forEach(function(sheet) {
      var sheetName = sheet.getName();
      if (sheetName.startsWith('_')) return;

      var lastRow = sheet.getLastRow();
      var lastCol = sheet.getLastColumn();
      if (lastRow < 2 || lastCol < 1) return;

      var data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
      var headers = data[0];
      var dateIdx = headers.indexOf('조사일자');
      var farmIdx = headers.indexOf('농가명');
      if (dateIdx === -1 || farmIdx === -1) return;

      var matchRows = [];
      for (var i = 1; i < data.length; i++) {
        var r = data[i];
        var dateVal = String(r[dateIdx] || '');
        var farmVal = String(r[farmIdx] || '');
        if (dateVal.startsWith(year) && farmVal === farmName) {
          var obj = {};
          headers.forEach(function(h, j) {
            if (r[j] !== '' && r[j] !== null && r[j] !== undefined) obj[h] = r[j];
          });
          matchRows.push(obj);
        }
      }
      if (matchRows.length > 0) result[sheetName] = matchRows;
    });

    return ContentService.createTextOutput(
      JSON.stringify(result)
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', message: err.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// ── 헬퍼 함수들 ─────────────────────────────────────────────────────

function getOrCreateSheet(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    var defaultHeaders = HEADERS[sheetName] || HEADERS['비대조사'];
    sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
    sheet.setFrozenRows(1);
    var headerRange = sheet.getRange(1, 1, 1, defaultHeaders.length);
    headerRange.setBackground('#1a237e');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    sheet.setColumnWidths(1, defaultHeaders.length, 90);
  }
  return sheet;
}

function getHeaders(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0];
}

function buildRow(headers, row, measurements) {
  return headers.map(function(h) {
    if (h === '조사일자') return row.surveyDate || '';
    if (h === '농가명')   return row.farmName || '';
    if (h === '라벨')     return row.label || '';
    if (h === '처리')     return row.treatment || '';
    if (h === '조사나무') return row.treeNo || '';
    if (h === '조사과실') return row.fruitNo || '';
    if (h === '비고')     return row.memo || '';
    if (h === '조사자')   return row.observer || '';
    return measurements[h] !== undefined ? measurements[h] : '';
  });
}

// 기존 행 찾기 — KEY_COLS 기준
// 반환값: 시트 행 번호 (1-based), 없으면 -1
function findExistingRow(sheet, headers, row) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var lastCol = headers.length;

  // KEY_COLS의 헤더 인덱스
  var keyIndices = KEY_COLS.map(function(col) { return headers.indexOf(col); });
  if (keyIndices.some(function(idx) { return idx === -1; })) return -1;

  // 키값 (row 객체에서 추출)
  var keyValues = [
    String(row.surveyDate  || ''),
    String(row.farmName    || ''),
    String(row.label       || ''),
    String(row.treatment   || ''),
    String(row.treeNo      || ''),
    String(row.fruitNo     || ''),
  ];

  var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  for (var i = 0; i < data.length; i++) {
    var match = keyIndices.every(function(colIdx, ki) {
      return String(data[i][colIdx] || '') === keyValues[ki];
    });
    if (match) return i + 2; // +1 for header, +1 for 1-based
  }
  return -1;
}
