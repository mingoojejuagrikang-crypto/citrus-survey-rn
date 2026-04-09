# Apps Script Contract

이 앱은 Google Apps Script 웹앱과 아래 계약을 기대한다.

## 1. GET 복구 API

요청:
```http
GET /exec?year=2025&farm=이원창
```

현재 실제 확인된 응답 형식:
```json
{
  "status": "ok",
  "data": {
    "비대조사": [
      {
        "조사일자": "2025-08-05",
        "기준일자": "2025-08-01",
        "농가명": "이원창",
        "라벨": "A",
        "처리": "시험",
        "조사나무": 1,
        "조사과실": 1,
        "횡경": 38.7,
        "종경": 34.9
      }
    ],
    "품질조사": [
      {
        "조사일자": "2025-08-05",
        "기준일자": "2025-08-01",
        "농가명": "이원창",
        "라벨": "A",
        "처리": "시험",
        "조사나무": 1,
        "조사과실": 1,
        "당도": 11.2
      }
    ]
  }
}
```

클라이언트는 wide row 형식과 row-per-item 형식을 모두 허용한다.

## 2. POST 동기화 API

클라이언트 1차 시도:
```http
POST /exec
Content-Type: application/json
```

본문:
```json
{
  "action": "upsertSamples",
  "sheetId": "1_d5L8jI583LN1n6rJ1H8_mPcsKMgEiYnYXhS_JOppDU",
  "rows": [
    {
      "sheetName": "비대조사",
      "values": {
        "조사일자": "2026-04-09",
        "농가명": "이원창",
        "라벨": "A",
        "처리구": "시험",
        "조사나무": 1,
        "조사과실": 1,
        "조사자": "홍길동",
        "횡경": 52.3,
        "종경": 48.1,
        "병해충": "응애",
        "비고": "과실 상태 양호"
      }
    }
  ]
}
```

클라이언트 2차 fallback 시도:
```http
POST /exec
Content-Type: application/x-www-form-urlencoded
```

본문:
```txt
action=upsertSamples
sheetId=...
rows=[...JSON...]
```

성공 응답 최소 조건:
```json
{ "success": true }
```

또는:
```json
{ "status": "ok" }
```

실패 응답 권장:
```json
{ "status": "error", "message": "원인" }
```

## 3. 시트 upsert 기준

- 시트 분리: `비대조사`, `품질조사`, `추가조사`
- 샘플 키:
  `조사일자 + 농가명 + 라벨 + 처리구 + 조사나무 + 조사과실`
- 같은 키가 있으면 update, 없으면 append

## 4. 컬럼 순서

```txt
조사일자, 농가명, 라벨, 처리구, 조사나무, 조사과실, 조사자,
[측정항목들...], 병해충, 비고
```

## 5. 현재 상태

- `GET`은 실제 서버에서 정상 응답 확인
- `POST`는 현재 배포 상태에서 JSON 응답을 주지 않아 클라이언트에서 동기화를 실패로 처리함
- 서버 `doPost` 구현 또는 웹앱 재배포 확인이 필요함
