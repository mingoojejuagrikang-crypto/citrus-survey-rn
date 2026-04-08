// ═══════════════════════════════════════════════════════════════════
// 감귤 생육조사 앱 — Google Apps Script
// 이 파일을 Google Sheets의 확장 프로그램 → Apps Script에 붙여넣기
// 스프레드시트 ID를 SPREADSHEET_ID 상수에 입력하세요.
// ═══════════════════════════════════════════════════════════════════

var SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';

// 헤더 정의
var HEADERS = {
  '비대조사': ['조사일자', '농가명', '라벨', '처리', '조사나무', '조사과실', '횡경', '종경', '비고', '조사자'],
  '품질조사': ['조사일자', '농가명', '라벨', '처리', '조사나무', '조사과실', '횡경', '종경', '과중', '과피중', '과피두께x4', '과피두께', '당도', '적정', '산함량', '당산도', '착색', '비파괴', '비고', '조사자'],
};

var FIXED_COLS = ['조사일자', '농가명', '라벨', '처리', '조사나무', '조사과실'];
var META_COLS = ['비고', '조사자'];

// ── doPost: 앱에서 데이터 수신 → 시트에 APPEND ──────────────────────

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var rows = data.rows || [data];
    var count = 0;

    rows.forEach(function(row) {
      var sheetName = row.surveyType || '비대조사';
      var sheet = getOrCreateSheet(ss, sheetName);
      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

      // 측정값에서 새 항목 헤더 추가 (비고/조사자 앞에)
      var measurements = row.measurements || {};
      Object.keys(measurements).forEach(function(key) {
        if (headers.indexOf(key) === -1 && META_COLS.indexOf(key) === -1) {
          var insertCol = headers.indexOf('비고');
          if (insertCol === -1) insertCol = headers.length;
          sheet.insertColumnBefore(insertCol + 1);
          sheet.getRange(1, insertCol + 1).setValue(key);
          headers.splice(insertCol, 0, key);
        }
      });

      // 행 데이터 구성
      var newRow = headers.map(function(h) {
        if (h === '조사일자') return row.surveyDate || '';
        if (h === '농가명') return row.farmName || '';
        if (h === '라벨') return row.label || '';
        if (h === '처리') return row.treatment || '';
        if (h === '조사나무') return row.treeNo || '';
        if (h === '조사과실') return row.fruitNo || '';
        if (h === '비고') return row.memo || '';
        if (h === '조사자') return row.observer || '';
        return measurements[h] !== undefined ? measurements[h] : '';
      });

      sheet.appendRow(newRow);
      count++;
    });

    return ContentService.createTextOutput(
      JSON.stringify({ status: 'ok', count: count })
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
      if (sheetName.startsWith('_')) return; // 내부 시트 제외

      var lastRow = sheet.getLastRow();
      var lastCol = sheet.getLastColumn();
      if (lastRow < 2 || lastCol < 1) return;

      var data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
      var headers = data[0];
      var dateIdx = headers.indexOf('조사일자');
      var farmIdx = headers.indexOf('농가명');
      if (dateIdx === -1 || farmIdx === -1) return;

      var rows = [];
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        var dateVal = String(row[dateIdx] || '');
        var farmVal = String(row[farmIdx] || '');
        if (dateVal.startsWith(year) && farmVal === farmName) {
          var obj = {};
          headers.forEach(function(h, j) {
            if (row[j] !== '' && row[j] !== null && row[j] !== undefined) {
              obj[h] = row[j];
            }
          });
          rows.push(obj);
        }
      }

      if (rows.length > 0) result[sheetName] = rows;
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

// ── 시트 가져오기 또는 생성 ─────────────────────────────────────────

function getOrCreateSheet(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    var defaultHeaders = HEADERS[sheetName] || HEADERS['비대조사'];
    sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
    sheet.setFrozenRows(1);
    // 헤더 스타일
    var headerRange = sheet.getRange(1, 1, 1, defaultHeaders.length);
    headerRange.setBackground('#1a237e');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    sheet.setColumnWidths(1, defaultHeaders.length, 90);
  }
  return sheet;
}
