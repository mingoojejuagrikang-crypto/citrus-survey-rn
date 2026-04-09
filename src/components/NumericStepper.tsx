import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/theme';

type Props = {
  label: string;
  value: number;
  onChange: (delta: number) => void;
};

export function NumericStepper({ label, value, onChange }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable onPress={() => onChange(-1)} style={styles.button}>
          <Text style={styles.buttonText}>-</Text>
        </Pressable>
        <Text style={styles.value}>{value}</Text>
        <Pressable onPress={() => onChange(1)} style={styles.button}>
          <Text style={styles.buttonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 8,
  },
  label: {
    color: colors.subtext,
    fontSize: 13,
  },
  row: {
    alignItems: 'center',
    backgroundColor: colors.panelMuted,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.chip,
    borderRadius: 12,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  buttonText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  value: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
});
