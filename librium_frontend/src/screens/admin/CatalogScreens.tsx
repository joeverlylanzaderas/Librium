// admin/CatalogScreens.tsx
import React, { useEffect, useState } from 'react';
import { Picker } from '@react-native-picker/picker';
import {
  View, Text, ScrollView, StyleSheet, Alert, Modal,
  RefreshControl, TouchableOpacity, ActivityIndicator, useWindowDimensions, TextInput
} from 'react-native';
import { Card, Btn, Empty, Loading, SectionHeader, Badge } from '../../components/UI';
import { useAlert } from '../../components/AlertProvider';
import { Fonts } from '../../constants/theme';
import { Feather } from '@expo/vector-icons';
import {
  getAuthors, createAuthor, updateAuthor, deleteAuthor,
  getCategories, createCategory, updateCategory, deleteCategory,
  getDepartments, createDepartment, updateDepartment, deleteDepartment,
  getSemesters, createSemester, updateSemester, deleteSemester, setActiveSemester,
} from '../../services/api';

// ─────────────────────────────────────────────────────────────
//  Generic CRUD factory — Authors, Categories, Departments
// ─────────────────────────────────────────────────────────────

function makeListScreen(
  fetchFn: () => Promise<any>,
  createFn: (data: any) => Promise<any>,
  updateFn: (id: number, data: any) => Promise<any>,
  deleteFn: (id: number) => Promise<any>,
  fields: { key: string; label: string; required?: boolean; numeric?: boolean; multiline?: boolean; placeholder?: string }[],
  title: string,
) {
  return function GenericScreen() {
    const { width } = useWindowDimensions();
    const [items, setItems]       = useState<any[]>([]);
    const [loading, setLoading]   = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modal, setModal]       = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [saving, setSaving]     = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [form, setForm]         = useState<Record<string, string>>(
      Object.fromEntries(fields.map((f) => [f.key, '']))
    );
    const { showConfirm } = useAlert();
    const confirmModal = (title: string, message: string, onConfirm: () => void) => {
      showConfirm(title, message, onConfirm, { confirmText: 'Delete', cancelText: 'Cancel' });
    };

    const load = async () => {
      try {
        const data = await fetchFn();
        setItems(data.results ?? data);
      } catch {
        Alert.alert('Error', 'Failed to load data.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };

    useEffect(() => { load(); }, []);

    const resetForm = () => {
      setForm(Object.fromEntries(fields.map((f) => [f.key, ''])));
      setEditingItem(null);
    };

    const handleSave = async () => {
      for (const f of fields.filter((f) => f.required)) {
        if (!form[f.key]) return Alert.alert('Required', `${f.label} is required.`);
      }
      setSaving(true);
      try {
        const payload = Object.fromEntries(
          fields.map((f) => [f.key, f.numeric ? (parseInt(form[f.key]) || null) : form[f.key]])
        );
        if (editingItem) await updateFn(editingItem.id, payload);
        else await createFn(payload);
        setModal(false);
        resetForm();
        load();
      } catch (e: any) {
        Alert.alert('Error', e?.data?.message ?? e?.message ?? 'Operation failed.');
      } finally {
        setSaving(false);
      }
    };

    const handleDelete = (item: any) => {
      const label = item[fields[0].key] ?? 'this item';
      confirmModal(
        'Confirm Delete',
        `Delete "${label}"? This cannot be undone.`,
        async () => {
          setDeletingId(item.id);
          try {
            await deleteFn(item.id);
            setItems((prev) => prev.filter((i) => i.id !== item.id));
          } catch {
            Alert.alert('Error', 'Delete failed. The item may be referenced by other records.');
          } finally {
            setDeletingId(null);
          }
        }
      );
    };

    // Responsive card size engine
    const cols = width > 1024 ? 3 : width > 640 ? 2 : 1;
    const GAP = 16;
    const PADDING = width > 768 ? 48 : 32;
    const cardWidth = (width - PADDING - GAP * (cols - 1)) / cols;

    if (loading) return <Loading />;

    return (
        <View style={s.root}>
          <ScrollView
            contentContainerStyle={[s.inner, { padding: width > 768 ? 24 : 16 }]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); load(); }}
                tintColor="#281711"
              />
            }
          >
            <View style={s.headerContainer}>
              <Text style={{ color: '#281711', fontSize: 15, fontWeight: '700' }}>
                {title} ({items.length})
              </Text>
              <TouchableOpacity 
                style={s.addButton} 
                activeOpacity={0.8}
                onPress={() => { resetForm(); setModal(true); }}
              >
                <Feather name="plus" size={16} color="#F4EFE0" />
                <Text style={s.addButtonText}>Add {title.slice(0, -1)}</Text>
              </TouchableOpacity>
            </View>

            {items.length === 0 && <Empty text={`No ${title.toLowerCase()} yet.`} />}

            <View style={s.gridContainer}>
              {items.map((item) => (
                <Card key={item.id} style={{ ...s.customCard, width: cardWidth }}>
                  <View style={s.cardContent}>
                    <View style={s.cardInfo}>
                      {fields.map((f, idx) => (
                        <Text key={f.key} style={idx === 0 ? s.itemTitle : s.itemMeta}>
                          {idx === 0 ? item[f.key] : `${f.label}: ${item[f.key] ?? '—'}`}
                        </Text>
                      ))}
                    </View>

                    <View style={s.cardActions}>
                      <TouchableOpacity
                        style={s.actionButton}
                        activeOpacity={0.7}
                        onPress={() => {
                          setEditingItem(item);
                          setForm(Object.fromEntries(fields.map((f) => [f.key, item[f.key]?.toString() ?? ''])));
                          setModal(true);
                        }}
                      >
                        <Feather name="edit" size={14} color="#513E2F" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[s.actionButton, s.deleteActionButton]}
                        activeOpacity={0.7}
                        onPress={() => handleDelete(item)}
                        disabled={deletingId === item.id}
                      >
                        {deletingId === item.id ? (
                          <ActivityIndicator size="small" color="#C53030" />
                        ) : (
                          <Feather name="trash-2" size={14} color="#C53030" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          </ScrollView>

          <Modal visible={modal} animationType="fade" transparent onRequestClose={() => { setModal(false); resetForm(); }}>
            <View style={s.modalOverlay}>
              <View style={s.sheet}>
                <View style={s.sheetHeader}>
                  <Text style={s.sheetTitle}>
                    {editingItem ? `EDIT ${title.slice(0, -1).toUpperCase()}` : `ADD NEW ${title.slice(0, -1).toUpperCase()}`}
                  </Text>
                  <TouchableOpacity onPress={() => { setModal(false); resetForm(); }}>
                    <Feather name="x" size={18} color="#281711" />
                  </TouchableOpacity>
                </View>
                <View style={s.sheetDivider} />
                
                <ScrollView showsVerticalScrollIndicator={false} style={s.modalScroll}>
                  {fields.map((f) => (
                    <View key={f.key} style={s.modalInputWrapper}>
                      <Text style={s.modalInputLabel}>{f.label}{f.required ? ' *' : ''}</Text>
                      <View style={s.customInputContainer}>
                        <TextInput
                          value={form[f.key]}
                          onChangeText={(v) => setForm({ ...form, [f.key]: v })}
                          placeholder={f.placeholder ?? `Enter ${f.label.toLowerCase()}`}
                          placeholderTextColor="#A1927F"
                          keyboardType={f.numeric ? 'numeric' : 'default'}
                          multiline={f.multiline}
                          numberOfLines={f.multiline ? 3 : 1}
                          style={[s.customInnerInput, f.multiline && s.customInnerInputMultiline]}
                        />
                      </View>
                    </View>
                  ))}
                </ScrollView>
                
                <View style={s.modalBtns}>
                  <TouchableOpacity style={s.cancelBtnTouch} onPress={() => { setModal(false); resetForm(); }}>
                    <Text style={s.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <Btn 
                    label={editingItem ? 'UPDATE' : 'SAVE RECORD'} 
                    onPress={handleSave} 
                    loading={saving} 
                  />
                </View>
              </View>
            </View>
          </Modal>
        </View>
    );
  };
}

// ── Screen exports ────────────────────────────────────────────

export const AuthorsScreen = makeListScreen(
  getAuthors, createAuthor, updateAuthor, deleteAuthor,
  [
    { key: 'name',        label: 'Name',        required: true },
    { key: 'biography',   label: 'Biography',   multiline: true },
    { key: 'nationality', label: 'Nationality' },
  ],
  'Authors'
);

export const CategoriesScreen = makeListScreen(
  getCategories, createCategory, updateCategory, deleteCategory,
  [
    { key: 'name',        label: 'Name',        required: true },
    { key: 'description', label: 'Description', multiline: true },
  ],
  'Categories'
);

export const DepartmentsScreen = makeListScreen(
  getDepartments, createDepartment, updateDepartment, deleteDepartment,
  [
    { key: 'name',        label: 'Name',        required: true },
    { key: 'description', label: 'Description', multiline: true },
  ],
  'Departments'
);

// ─────────────────────────────────────────────────────────────
//  Semesters Screen
// ─────────────────────────────────────────────────────────────

export function SemestersScreen() {
  const { width } = useWindowDimensions();
  const { showConfirm } = useAlert();
  const confirmModal = (title: string, message: string, onConfirm: () => void) => {
    showConfirm(title, message, onConfirm, { confirmText: 'Delete', cancelText: 'Cancel' });
  };
  const [items, setItems]           = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal]           = useState(false);
  const [editing, setEditing]       = useState<any>(null);
  const [saving, setSaving]     = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [form, setForm]             = useState({
    academic_year: '', semester_type: '', start_date: '', end_date: '',
  });

  const load = async () => {
    try {
      const data = await getSemesters();
      setItems(data.results ?? data);
    } catch { Alert.alert('Error', 'Failed to load semesters.'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.academic_year || !form.semester_type) {
      return Alert.alert('Required', 'Academic year and semester type are required.');
    }
    setSaving(true);
    try {
      if (editing) await updateSemester(editing.id, form);
      else await createSemester(form);
      setModal(false);
      setEditing(null);
      setForm({ academic_year: '', semester_type: '', start_date: '', end_date: '' });
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.data?.message ?? 'Operation failed.');
    } finally { setSaving(false); }
  };

  const handleDelete = (sem: any) => {
    if (sem.is_active) {
      Alert.alert('Notice', 'Deactivate this semester before deleting it.');
      return;
    }
    confirmModal(
      'Confirm Delete',
      `Delete "${formatSemester(sem)}"?`,
      async () => {
        setDeletingId(sem.id);
        try {
          await deleteSemester(sem.id);
          setItems((prev) => prev.filter((i) => i.id !== sem.id));
        } catch {
          Alert.alert('Error', 'Delete failed.');
        } finally {
          setDeletingId(null);
        }
      }
    );
  };

  const formatSemester = (sem: any) => {
    const type = {
      '1st_sem': '1st Semester',
      '2nd_sem': '2nd Semester',
      'summer':  'Summer',
    }[sem.semester_type as string] ?? sem.semester_type;
    return `${type} — ${sem.academic_year}`;
  };

  const cols = width > 1024 ? 3 : width > 640 ? 2 : 1;
  const GAP = 16;
  const PADDING = width > 768 ? 48 : 32;
  const cardWidthStyle = {
    width: (width - PADDING - GAP * (cols - 1)) / cols,
  };

  if (loading) return <Loading />;

  return (
      <View style={s.root}>
        <ScrollView
          contentContainerStyle={[s.inner, { padding: width > 768 ? 24 : 16 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor="#281711"
            />
          }
        >
          <View style={s.headerContainer}>
            <Text style={{ color: '#281711', fontSize: 15, fontWeight: '700' }}>
              Semesters ({items.length})
            </Text>
            <TouchableOpacity 
              style={s.addButton} 
              activeOpacity={0.8}
              onPress={() => {
                setEditing(null);
                setForm({ academic_year: '', semester_type: '', start_date: '', end_date: '' });
                setModal(true);
              }}
            >
              <Feather name="plus" size={16} color="#F4EFE0" />
              <Text style={s.addButtonText}>Add Semester</Text>
            </TouchableOpacity>
          </View>

          {items.length === 0 && <Empty text="No semesters yet." />}

          <View style={s.gridContainer}>
            {items.map((sem) => (
              <Card key={sem.id} style={{ ...s.customCard, ...cardWidthStyle }}>
                <View style={s.cardContent}>
                  <View style={s.cardInfo}>
                    <Text style={s.itemTitle}>{formatSemester(sem)}</Text>
                    <Text style={s.itemMeta}>
                      {sem.start_date
                        ? `${sem.start_date} → ${sem.end_date ?? 'No end date'}`
                        : 'Dates not set'}
                    </Text>
                  </View>

                  <View style={s.cardActions}>
                    {sem.is_active ? (
                      <Badge label="ACTIVE" color="#137333" />
                    ) : (
                      <>
                        <TouchableOpacity
                          style={s.actionButton}
                          activeOpacity={0.7}
                          onPress={() => {
                            setEditing(sem);
                            setForm({
                              academic_year: sem.academic_year,
                              semester_type: sem.semester_type,
                              start_date:    sem.start_date ?? '',
                              end_date:      sem.end_date   ?? '',
                            });
                            setModal(true);
                          }}
                        >
                          <Feather name="edit" size={14} color="#513E2F" />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[s.actionButton, s.deleteActionButton]}
                          activeOpacity={0.7}
                          onPress={() => handleDelete(sem)}
                          disabled={deletingId === sem.id}
                        >
                          {deletingId === sem.id
                            ? <ActivityIndicator size="small" color="#C53030" />
                            : <Feather name="trash-2" size={14} color="#C53030" />
                          }
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={s.inlineGhostButton}
                          activeOpacity={0.7}
                          onPress={async () => { await setActiveSemester(sem.id); load(); }}
                        >
                          <Text style={s.inlineGhostButtonText}>Set Active</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              </Card>
            ))}
          </View>
        </ScrollView>

        <Modal visible={modal} animationType="fade" transparent onRequestClose={() => setModal(false)}>
          <View style={s.modalOverlay}>
            <View style={s.sheet}>
              <View style={s.sheetHeader}>
                <Text style={s.sheetTitle}>{editing ? 'EDIT SEMESTER' : 'ADD NEW SEMESTER'}</Text>
                <TouchableOpacity onPress={() => setModal(false)}>
                  <Feather name="x" size={18} color="#281711" />
                </TouchableOpacity>
              </View>
              <View style={s.sheetDivider} />

              <ScrollView showsVerticalScrollIndicator={false} style={s.modalScroll}>
                <View style={s.modalInputWrapper}>
                  <Text style={s.modalInputLabel}>Academic Year *</Text>
                  <View style={s.customInputContainer}>
                    <TextInput
                      value={form.academic_year}
                      onChangeText={(v) => setForm({ ...form, academic_year: v })}
                      placeholder="e.g. 2025-2026"
                      placeholderTextColor="#A1927F"
                      style={s.customInnerInput}
                    />
                  </View>
                </View>

                <View style={s.modalInputWrapper}>
                  <Text style={s.modalInputLabel}>Semester Type *</Text>
                  <View style={s.pickerOutline}>
                    <Picker
                      selectedValue={form.semester_type}
                      onValueChange={(v) => setForm({ ...form, semester_type: v })}
                      style={s.customPickerElement}
                    >
                      <Picker.Item label="Select Semester Type" value="" style={s.pickerPlaceholderItem} />
                      <Picker.Item label="1st Semester" value="1st_sem" />
                      <Picker.Item label="2nd Semester" value="2nd_sem" />
                      <Picker.Item label="Summer"       value="summer" />
                    </Picker>
                  </View>
                </View>

                <View style={s.modalInputWrapper}>
                  <Text style={s.modalInputLabel}>Start Date</Text>
                  <View style={s.customInputContainer}>
                    <TextInput
                      value={form.start_date}
                      onChangeText={(v) => setForm({ ...form, start_date: v })}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#A1927F"
                      style={s.customInnerInput}
                    />
                  </View>
                </View>

                <View style={s.modalInputWrapper}>
                  <Text style={s.modalInputLabel}>End Date</Text>
                  <View style={s.customInputContainer}>
                    <TextInput
                      value={form.end_date}
                      onChangeText={(v) => setForm({ ...form, end_date: v })}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#A1927F"
                      style={s.customInnerInput}
                    />
                  </View>
                </View>
              </ScrollView>

              <View style={s.modalBtns}>
                <TouchableOpacity style={s.cancelBtnTouch} onPress={() => { setModal(false); setEditing(null); }}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <Btn 
                  label={editing ? 'UPDATE' : 'SAVE RECORD'} 
                  onPress={handleSave} 
                  loading={saving} 
                />
              </View>
            </View>
          </View>
        </Modal>
      </View>
  );
}

// ── Shared Editorial Dashboard Stylesheet ──────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FBFBFA', 
  },
  inner: {
    paddingBottom: 60,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    borderBottomWidth: 1,
    borderColor: '#E8E4D9',
    paddingBottom: 16,
  },
  addButton: {
    backgroundColor: '#281711',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 0, 
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addButtonText: {
    fontFamily: Fonts.sans,
    color: '#F4EFE0',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    width: '100%',
  },
  customCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE7DF',
    borderRadius: 0, 
    padding: 18,
    minWidth: 280,
    // Note: dynamic width handled via inline layout styling in runtime
  },
  cardContent: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    height: '100%',
  },
  cardInfo: {
    marginBottom: 16,
  },
  itemTitle: {
    color: '#281711',
    fontFamily: Fonts.baskervilleBold,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 6,
  },
  itemMeta: {
    color: '#4A3E3D', 
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    borderTopWidth: 1,
    borderColor: '#F3F1EC',
    paddingTop: 12,
  },
  actionButton: {
    width: 32,
    height: 32,
    backgroundColor: '#F4F1EA',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 0,
  },
  deleteActionButton: {
    backgroundColor: '#FCE8E6',
  },
  inlineGhostButton: {
    borderWidth: 1,
    borderColor: '#281711',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 0,
  },
  inlineGhostButtonText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#281711',
    fontWeight: '600',
  },
  activeBadgeOverride: {
    backgroundColor: '#E6F4EA',
    color: '#137333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(40, 23, 17, 0.5)', 
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  sheet: {
    backgroundColor: '#F5F1E6', 
    borderWidth: 1,
    borderColor: '#DCD4C4',
    borderRadius: 0,
    padding: 24,
    width: '100%',
    maxWidth: 460,
    maxHeight: '90%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetTitle: {
    color: '#281711',
    fontFamily: Fonts.baskervilleBold,
    fontSize: 14,
    letterSpacing: 1.5,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: '#DCD4C4',
    marginTop: 12,
    marginBottom: 20,
  },
  modalScroll: {
    marginBottom: 12,
  },
  modalInputWrapper: {
    marginBottom: 16,
  },
  modalInputLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#3C2F2F',
    marginBottom: 6,
    fontWeight: '600',
  },
  customInputContainer: {
    borderWidth: 1,
    borderColor: '#DCD4C4',
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    minHeight: 40,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  customInnerInput: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: '#281711',
    paddingLeft: 8,
    backgroundColor: 'transparent',
    borderWidth: 0,
    height: 40,
  },
  customInnerInputMultiline: {
    height: 80,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  pickerOutline: {
    borderWidth: 1,
    borderColor: '#DCD4C4',
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    height: 40,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  customPickerElement: {
    color: '#281711',
    backgroundColor: 'transparent',
    fontFamily: Fonts.sans,
    fontSize: 14,
    borderWidth: 0,
  },
  pickerPlaceholderItem: {
    color: '#A1927F',
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  cancelBtnTouch: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#281711',
    borderRadius: 0,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  cancelBtnText: {
    fontFamily: Fonts.sans,
    color: '#281711',
    fontSize: 12,
    fontWeight: '600',
  },
});