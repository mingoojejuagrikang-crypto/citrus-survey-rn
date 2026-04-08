import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { COLORS } from './src/utils/constants';
import SurveyScreen from './src/screens/SurveyScreen';
import DataScreen from './src/screens/DataScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { useSurveyStore } from './src/stores/SurveyStore';
import { getConfig, setConfig } from './src/services/DatabaseService';
import { startNetworkWatcher, getUnsyncedCount } from './src/services/SyncService';

const DEFAULT_WEBAPP_URL =
  'https://script.google.com/macros/s/AKfycbyGayON8Uykgzb8H_sozo5ngvLG-39znIWJrcyuvxKoHspx_ADScgOSoBTLzl4CtWnE/exec';

const Tab = createBottomTabNavigator();

const DarkTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: COLORS.bg,
    card: COLORS.surface,
    text: COLORS.text,
    border: COLORS.border,
    primary: COLORS.primary,
    notification: COLORS.primary,
  },
};

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
  );
}

function UnsyncedBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <View style={{
      position: 'absolute', top: -4, right: -10,
      backgroundColor: COLORS.error,
      borderRadius: 8, minWidth: 16, height: 16,
      alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 3,
    }}>
      <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}

export default function App() {
  const { setSession, setWebAppUrl, setFarmList, setUnsyncedCount, unsyncedCount } = useSurveyStore();

  useEffect(() => {
    async function init() {
      // DB에서 설정 로드
      const observer = await getConfig('observer');
      const webUrl = await getConfig('webAppUrl');
      const farmList = await getConfig('farmList');
      const label = await getConfig('defaultLabel');
      const treatment = await getConfig('defaultTreatment');
      const surveyType = await getConfig('surveyType') as '비대조사' | '품질조사' | null;

      if (observer) setSession({ observer });
      // webAppUrl: DB 저장값 우선, 없으면 기본값 자동 설정
      const resolvedUrl = webUrl || DEFAULT_WEBAPP_URL;
      if (!webUrl) await setConfig('webAppUrl', DEFAULT_WEBAPP_URL);
      setWebAppUrl(resolvedUrl);
      if (farmList) setFarmList(JSON.parse(farmList));
      if (label) setSession({ label });
      if (treatment) setSession({ treatment });
      if (surveyType) setSession({ surveyType });

      // 미동기화 건수 초기 로드
      const count = await getUnsyncedCount();
      setUnsyncedCount(count);

      // 네트워크 감시 시작
      startNetworkWatcher((synced) => {
        if (synced > 0) {
          getUnsyncedCount().then(setUnsyncedCount);
        }
      });
    }
    init();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor={COLORS.bg} />
      <NavigationContainer theme={DarkTheme}>
        <Tab.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: COLORS.surface, borderBottomColor: COLORS.border, borderBottomWidth: 1 },
            headerTintColor: COLORS.text,
            headerTitleStyle: { fontWeight: '700' },
            tabBarStyle: {
              backgroundColor: COLORS.surface,
              borderTopColor: COLORS.border,
              borderTopWidth: 1,
            },
            tabBarActiveTintColor: COLORS.primary,
            tabBarInactiveTintColor: COLORS.textDim,
            tabBarLabelStyle: { fontSize: 11, marginBottom: 2 },
          }}
        >
          <Tab.Screen
            name="Survey"
            component={SurveyScreen}
            options={{
              title: '조사',
              headerTitle: '🍊 감귤 생육조사',
              tabBarLabel: '조사',
              tabBarIcon: ({ focused }) => <TabIcon emoji="🎙" focused={focused} />,
            }}
          />
          <Tab.Screen
            name="Data"
            component={DataScreen}
            options={{
              title: '기록',
              headerTitle: '기록',
              tabBarLabel: '기록',
              tabBarIcon: ({ focused }) => (
                <View>
                  <TabIcon emoji="📋" focused={focused} />
                  <UnsyncedBadge count={unsyncedCount} />
                </View>
              ),
            }}
          />
          <Tab.Screen
            name="Progress"
            component={ProgressScreen}
            options={{
              title: '진행률',
              headerTitle: '진행률',
              tabBarLabel: '진행률',
              tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} />,
            }}
          />
          <Tab.Screen
            name="Settings"
            component={SettingsScreen}
            options={{
              title: '설정',
              headerTitle: '설정',
              tabBarLabel: '설정',
              tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" focused={focused} />,
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
