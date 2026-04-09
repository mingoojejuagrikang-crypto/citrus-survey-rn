import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import { colors } from '../constants/theme';
import { ProgressScreen } from '../screens/ProgressScreen';
import { RecordsScreen } from '../screens/RecordsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SurveyScreen } from '../screens/SurveyScreen';

const Tab = createBottomTabNavigator();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.panel,
    border: colors.border,
    primary: colors.accent,
    text: colors.text,
    notification: colors.warning,
  },
};

export function RootNavigator() {
  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.panel,
            borderTopColor: colors.border,
            height: 68,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '700',
          },
          tabBarIcon: ({ focused, color }) => (
            <Text style={{ color, fontSize: 14 }}>{focused ? '●' : '○'}</Text>
          ),
        }}
      >
        <Tab.Screen name="조사" component={SurveyScreen} />
        <Tab.Screen name="기록" component={RecordsScreen} />
        <Tab.Screen name="진행률" component={ProgressScreen} />
        <Tab.Screen name="설정" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
