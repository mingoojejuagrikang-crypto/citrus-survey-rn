# 감귤 생육조사 앱

현장 조사자가 iPhone과 블루투스 이어폰으로 감귤 생육조사 값을 음성 입력하고, 오프라인에서는 SQLite에 저장하고 온라인 복귀 시 Google Sheets로 동기화하는 Expo React Native 앱이다.

## 핵심 목표
- iPhone 실기기 우선
- 오프라인 우선
- `whisper.rn` 기반 한국어 음성 입력
- `react-native-tts` 기반 이어폰 피드백
- SQLite 로컬 저장, undo, 재동기화

## 현재 스택
- Expo SDK 54 + React Native 0.81
- `expo-sqlite`, `expo-file-system`, `expo-av`
- `whisper.rn`, `react-native-tts`
- React Navigation, Zustand, NetInfo

## 빠른 시작
```bash
npm install
npx expo install
npm run prebuild:ios
npm run pod:install
npm run typecheck
npm run lint
npm run test
npm run ios:device
npm run ios:release
```

## 현재 기본 연동값
- Apps Script URL:
  `https://script.google.com/macros/s/AKfycbyGayON8Uykgzb8H_sozo5ngvLG-39znIWJrcyuvxKoHspx_ADScgOSoBTLzl4CtWnE/exec`
- Google Sheets ID:
  `1_d5L8jI583LN1n6rJ1H8_mPcsKMgEiYnYXhS_JOppDU`
- 기본 농가:
  `이원창`, `강남호`, `양승보`

## 작업 원칙
- 작은 단위로 구현하고 바로 검증한다.
- 음성/저장/동기화는 실패 복구를 우선한다.
- 서버 연동 형식이 불명확한 항목은 클라이언트 구현 범위와 서버 필요 작업을 분리해 기록한다.

## 현재 서버 확인 결과
- `GET ?year=&farm=` 복구 API는 실제 응답 확인 완료
  형식: `{"status":"ok","data":{"비대조사":[...],"품질조사":[...]}}`
- `POST` 동기화 API는 현재 JSON 응답을 주지 않음
  앱에서는 JSON/form 두 방식 모두 진단하고 실패 이유를 설정 탭에 표시함
- 따라서 현재는 로컬 저장과 과거값 복구 테스트는 가능하고, Google Sheets 업로드는 서버 `doPost` 배포 상태 확인이 필요함

## 서버 연동 문서
- 계약 문서: `docs/apps-script-contract.md`
- 예시 Apps Script: `server/apps_script_example.gs`

## iOS Release 산출물
- archive 명령: `npm run ios:archive`
- export 명령: `npm run ios:export`
- 통합 실행: `npm run ios:release`
- 현재 export 성공 산출물:
  `ios/export/output/app.ipa`
