import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { sharedInputStyles, useResponsiveLayout } from '../ui/layout';
import { COLORS } from '../ui/theme';

interface Props {
  visible: boolean;
  title: string;
  items: { id: string; label: string; sublabel?: string }[];
  onSelect: (item: { id: string; label: string; sublabel?: string }) => void;
  onClose: () => void;
}

export default function PickerModal({ visible, title, items, onSelect, onClose }: Props) {
  const { isDesktop } = useResponsiveLayout();
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!visible) {
      setSearch('');
    }
  }, [visible]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => item.label.toLowerCase().includes(search.toLowerCase()));
  }, [items, search]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[styles.card, isDesktop && styles.cardDesktop]}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            style={sharedInputStyles.input}
            placeholder="Поиск"
            placeholderTextColor={COLORS.textSoft}
            value={search}
            onChangeText={setSearch}
          />
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <TouchableOpacity key={item.id} style={styles.item} onPress={() => onSelect(item)}>
                  <View style={styles.itemTextWrap}>
                    <Text style={styles.itemText}>{item.label}</Text>
                    {item.sublabel ? <Text style={styles.itemSublabel}>{item.sublabel}</Text> : null}
                  </View>
                  <Text style={styles.itemArrow}>Выбрать</Text>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.emptyText}>Ничего не найдено</Text>
            )}
          </ScrollView>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Закрыть</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 760,
    maxHeight: '80%',
    backgroundColor: COLORS.backgroundAlt,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    padding: 20,
    gap: 14,
  },
  cardDesktop: {
    padding: 24,
  },
  title: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '800',
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    gap: 10,
    paddingVertical: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  itemTextWrap: {
    flex: 1,
  },
  itemText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  itemSublabel: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  itemArrow: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  emptyText: {
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: 28,
    fontSize: 14,
  },
  closeBtn: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: COLORS.surfaceStrong,
  },
  closeBtnText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
});
