import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal, TextInput,
} from 'react-native';
import { COLORS } from '../theme';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

interface Props {
  visible: boolean;
  title: string;
  items: { id: string; label: string; sublabel?: string }[];
  onSelect: (item: { id: string; label: string; sublabel?: string }) => void;
  onClose: () => void;
}

export default function PickerModal({ visible, title, items, onSelect, onClose }: Props) {
  const [search, setSearch] = useState('');
  const filtered = items.filter((i) => i.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <Animated.View entering={FadeInDown.duration(240).reduceMotion(ReduceMotion.System)} style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Поиск..."
            placeholderTextColor={COLORS.textDim}
            value={search}
            onChangeText={setSearch}
          />
          <ScrollView style={styles.list}>
            {filtered.map((item) => (
              <TouchableOpacity key={item.id} style={styles.item} onPress={() => onSelect(item)}>
                <Text style={styles.itemText}>{item.label}</Text>
                {item.sublabel && <Text style={styles.itemSublabel}>{item.sublabel}</Text>}
              </TouchableOpacity>
            ))}
            {filtered.length === 0 && <Text style={styles.empty}>Ничего не найдено</Text>}
          </ScrollView>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Закрыть</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: COLORS.card, borderRadius: 0, padding: 20, width: '90%', maxHeight: '80%', borderWidth: 1, borderColor: COLORS.border },
  title: { color: COLORS.text, fontSize: 18, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  searchInput: { backgroundColor: COLORS.inputBg, borderRadius: 0, padding: 10, color: COLORS.text, fontSize: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 },
  list: { maxHeight: 400 },
  item: { paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  itemText: { color: COLORS.text, fontSize: 15 },
  itemSublabel: { color: COLORS.textDim, fontSize: 12, marginTop: 2 },
  empty: { color: COLORS.textDim, textAlign: 'center', padding: 20 },
  closeBtn: { marginTop: 12, backgroundColor: COLORS.inputBg, borderRadius: 0, padding: 12, alignItems: 'center' },
  closeText: { color: COLORS.textDim, fontSize: 14, fontWeight: '600' },
});
