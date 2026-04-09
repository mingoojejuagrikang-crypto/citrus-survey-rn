import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors } from '../constants/theme';

export function Panel({ style, ...rest }: ViewProps) {
  return <View {...rest} style={[styles.panel, style]} />;
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
});
