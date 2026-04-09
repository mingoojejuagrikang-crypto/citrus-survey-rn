import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { useEffect, useState } from 'react';

import { colors } from '../constants/theme';
import { ActionButton } from './ActionButton';

type Props = {
  visible: boolean;
  title: string;
  initialValue: string;
  onClose: () => void;
  onSubmit: (value: string) => void;
};

export function ContextModal({ visible, title, initialValue, onClose, onSubmit }: Props) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            autoFocus
            onChangeText={setValue}
            placeholderTextColor={colors.subtext}
            style={styles.input}
            value={value}
          />
          <View style={styles.actions}>
            <ActionButton label="취소" onPress={onClose} variant="secondary" />
            <ActionButton
              label="저장"
              onPress={() => {
                onSubmit(value.trim());
                onClose();
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    padding: 18,
    width: '100%',
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  input: {
    backgroundColor: colors.panelMuted,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
});
