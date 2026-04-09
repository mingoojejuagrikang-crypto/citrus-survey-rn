import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: '감귤 생육조사',
  slug: 'citrus-survey',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  newArchEnabled: true,
  scheme: 'citrussurvey',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#10141A',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.citrussurvey.app',
    infoPlist: {
      NSMicrophoneUsageDescription:
        '감귤 생육조사 음성 입력을 위해 마이크 권한이 필요합니다.',
      NSSpeechRecognitionUsageDescription:
        '오프라인 전사 결과를 현장 입력에 활용합니다.',
    },
  },
  android: {
    package: 'com.citrussurvey.app',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#10141A',
    },
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: ['expo-sqlite'],
  extra: {
    googleSheetsId: '1_d5L8jI583LN1n6rJ1H8_mPcsKMgEiYnYXhS_JOppDU',
    defaultWebAppUrl:
      'https://script.google.com/macros/s/AKfycbyGayON8Uykgzb8H_sozo5ngvLG-39znIWJrcyuvxKoHspx_ADScgOSoBTLzl4CtWnE/exec',
  },
};

export default config;
