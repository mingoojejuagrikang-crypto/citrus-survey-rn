# 🍊 감귤 생육조사 앱

감귤 생육조사 현장에서 음성으로 데이터를 입력하고 Google Sheets에 자동 기록하는 React Native (Expo) 앱.

## 주요 기능

- **음성 입력**: expo-speech-recognition + 한국어 퍼지매칭 파서
- **로컬 저장**: expo-sqlite (오프라인 완전 지원)
- **Google Sheets 동기화**: Apps Script 웹앱 연동 (배치 전송)
- **이전값 비교**: 15% 노란색, 30% 빨간색 경고
- **음성 녹음 백업**: 발화별 클립 저장 (최근 3일)
- **진행률 대시보드**: 나무/과실별 완료 현황
- **다크 테마**, 한국어 UI

## 설치

```bash
cd citrus-survey
npm install
npx expo start
```

## 개발 빌드 (기기에서 실행)

```bash
npx expo run:ios      # Mac + Xcode 필요
npx expo run:android  # Android Studio 필요
```

## EAS 클라우드 빌드

```bash
npm install -g eas-cli
eas login
eas build --profile development --platform all
```

## Google Sheets 연동 설정

1. 대상 Google Sheets 열기
2. **확장 프로그램 → Apps Script**
3. `apps-script/Code.gs` 내용 붙여넣기
4. `SPREADSHEET_ID` 상수에 스프레드시트 ID 입력
5. **배포 → 새 배포 → 웹 앱**
   - 실행 주체: "나"
   - 액세스: "모든 사용자"
6. 배포 URL 복사
7. 앱 **설정 탭** → 앱스 스크립트 URL 입력 → 저장

## 음성 명령어

| 발화 예시 | 동작 |
|----------|------|
| "횡경 38.5" | 횡경 = 38.5 저장 |
| "당도 9.2" | 당도 = 9.2 저장 |
| "농가 강남호" | 농가명 = 강남호 (이후 유지) |
| "라벨 B" | 라벨 = B (이후 유지) |
| "처리 관행" | 처리구 = 관행 (이후 유지) |
| "나무 2" | 조사나무 = 2 |
| "과실 3" | 조사과실 = 3 |
| "수정" | 수정 모드 ON (1회) |
| "비고 상태양호" | 비고 기록 |

## 퍼지 매칭

1. **정확 매칭**: FIELD_ALIASES 사전 (85개+)
2. **편집거리 1**: "형경" → "횡경"
3. **초성 비교**: "ㅎㄱ" → 횡경

maxAlternatives: 5개 후보 중 파싱 성공률 최고 선택

## 프로젝트 구조

```
citrus-survey/
├── App.tsx                      # 탭 네비게이션
├── src/
│   ├── screens/
│   │   ├── SurveyScreen.tsx     # 조사 화면 (음성+수동)
│   │   ├── DataScreen.tsx       # 기록 & 동기화
│   │   ├── ProgressScreen.tsx   # 진행률
│   │   └── SettingsScreen.tsx   # 설정
│   ├── services/
│   │   ├── VoiceService.ts      # 음성인식 + 녹음
│   │   ├── ParserService.ts     # 퍼지매칭 파서
│   │   ├── DatabaseService.ts   # SQLite CRUD
│   │   ├── SheetsService.ts     # Apps Script 연동
│   │   ├── SyncService.ts       # 오프라인→온라인 동기화
│   │   ├── HistoryService.ts    # 과거값 캐시
│   │   └── TTSService.ts        # TTS 피드백
│   ├── stores/
│   │   └── SurveyStore.ts       # Zustand 전역 상태
│   └── utils/
│       ├── constants.ts         # 항목 사전, 색상
│       └── exportCSV.ts         # CSV 내보내기
└── apps-script/
    └── Code.gs                  # Google Apps Script
```

## 비용

| 항목 | 비용 |
|------|------|
| Expo + EAS Build | 무료 (월 30회) |
| 음성인식 (OS 내장) | 무료 |
| SQLite | 무료 |
| Google Sheets | 무료 |
| Apple Developer | $99/년 (iOS 필수) |
| **합계** | **$99/년** (iOS만) |

## 이후 수정 예시

```bash
# contextualStrings에 신초장, 신초수 추가
# 비교 테이블 경고 기준 15%→10%로 변경
# 새 농가 "김철수" 별칭 추가
```
