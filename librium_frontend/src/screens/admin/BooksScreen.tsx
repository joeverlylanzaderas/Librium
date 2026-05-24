import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, Modal, TextInput,
  RefreshControl, TouchableOpacity, ActivityIndicator, Image,
  useWindowDimensions, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { Card, Btn, Empty, Loading, SectionHeader } from '../../components/UI';
import SidebarLayout from '../../components/SidebarLayout';
import { Fonts } from '../../constants/theme';
import { AdminStackParamList } from '../../navigation/AppNavigator';
import {
  getBooks, createBook, updateBook, deleteBook,
  getAuthors, getCategories, getDepartments,
} from '../../services/api';

type Props = {
  navigation: NativeStackNavigationProp<AdminStackParamList, 'Books'>;
};

const confirm = (title: string, message: string, onConfirm: () => void) => {
  if (typeof window !== 'undefined') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onConfirm },
    ]);
  }
};

const AVAIL_COLORS = {
  available: { bg: '#E6F4EA', text: '#137333', border: '#B7DFC4' },
  on_loan:   { bg: '#FCE8E6', text: '#8A2B2B', border: '#F5C2BC' },
};

export default function BooksScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();

  const [items, setItems]           = useState<any[]>([]);
  const [authors, setAuthors]       = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal]           = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [saving, setSaving]         = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [search, setSearch]         = useState('');
  const [filterAvail, setFilterAvail] = useState<'all' | 'available' | 'borrowed'>('all');

  const [form, setForm] = useState({
    title:            '',
    isbn:             '',
    publication_year: '',
    author:           '',
    category:         '',
    department:       '',
    description:      '',
    available:        true,
    cover_image:      null as string | null,
    cover_image_file: null as any,
  });

  const load = useCallback(async () => {
    try {
      const [books, auths, cats, depts] = await Promise.all([
        getBooks(), getAuthors(), getCategories(), getDepartments(),
      ]);
      setItems(books.results ?? books);
      setAuthors(auths.results ?? auths);
      setCategories(cats.results ?? cats);
      setDepartments(depts.results ?? depts);
    } catch {
      Alert.alert('Error', 'Failed to load book catalog.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setForm({ 
      title: '', 
      isbn: '', 
      publication_year: '', 
      author: '', 
      category: '', 
      department: '', 
      description: '', 
      available: true,
      cover_image: null,
      cover_image_file: null,
    });
    setEditingItem(null);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [2, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      
      // DEBUG: Log the full asset object
      console.log('Full asset:', JSON.stringify(asset, null, 2));
      console.log('Asset URI:', asset.uri);
      console.log('Asset type:', asset.type);
      console.log('Asset mimeType:', asset.mimeType);
      console.log('Asset fileName:', asset.fileName);
      
      setForm({ 
        ...form, 
        cover_image_file: {
          uri: asset.uri,
          type: asset.mimeType || 'image/jpeg',
          name: asset.fileName || `cover_${Date.now()}.jpg`,
        },
        cover_image: asset.uri,
      });
    }
  };

  const uploadImageToCloudinary = async () => {
    if (!form.cover_image_file) return null;

    setUploadingImage(true);
    const data = new FormData();

    // 🎯 FIX: Web compatibility fallback handling for Blob streaming
    if (Platform.OS === 'web') {
      try {
        // Fetch the raw local file binary structure directly from your blob URI pointer
        const responseBlob = await fetch(form.cover_image_file.uri);
        const fileBlob = await responseBlob.blob();
        
        // Append it cleanly as a standard native file stream object structure
        data.append('file', fileBlob, form.cover_image_file.name);
      } catch (blobError) {
        console.error('Error constructing binary blob object for web:', blobError);
        setUploadingImage(false);
        return null;
      }
    } else {
      // Keep your native mobile format structure safe for Android & iOS packaging targets
      data.append('file', {
        uri: form.cover_image_file.uri,
        type: form.cover_image_file.type,
        name: form.cover_image_file.name,
      } as any);
    }

    data.append('upload_preset', 'librium_covers');
    data.append('cloud_name', 'dz5b4xsjy');

    try {
      const response = await fetch('https://api.cloudinary.com/v1_1/dz5b4xsjy/image/upload', {
        method: 'POST',
        body: data,
        headers: {
          'Accept': 'application/json',
        },
      });

      const responseText = await response.text(); 
      console.log('Cloudinary Response Status:', response.status);
      console.log('Cloudinary Response Text:', responseText);

      if (!response.ok) {
        let errorDetail = responseText;
        try {
          const errorJson = JSON.parse(responseText);
          errorDetail = errorJson.error?.message || responseText;
        } catch (e) {
          // Ignore JSON parsing errors safely
        }
        throw new Error(`Upload failed (${response.status}): ${errorDetail}`);
      }

      const dataJson = JSON.parse(responseText);
      return dataJson.secure_url;
    } catch (error: any) {
      console.error('Cloudinary Upload Error:', error);
      Alert.alert('Upload Failed', error.message || 'Could not upload image. Please try again.');
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!form.title || !form.isbn) {
      return Alert.alert('Required', 'Title and ISBN are required.');
    }
    setSaving(true);
    try {
      let coverUrl = editingItem?.cover_image || null;
      
      if (form.cover_image_file) {
        const uploadedUrl = await uploadImageToCloudinary();
        if (uploadedUrl) coverUrl = uploadedUrl;
      }

      const payload: any = {
        title:            form.title,
        isbn:             form.isbn,
        publication_year: form.publication_year && form.publication_year.trim() !== '' 
                            ? parseInt(form.publication_year) 
                            : null, 
        description:      form.description || undefined,
        available:        form.available,
        cover_image:      coverUrl,
      };

      payload.author     = form.author && form.author.trim() !== '' ? parseInt(form.author) : null;
      payload.category   = form.category && form.category.trim() !== '' ? parseInt(form.category) : null;
      payload.department = form.department && form.department.trim() !== '' ? parseInt(form.department) : null;

      if (editingItem) await updateBook(editingItem.id, payload);
      else             await createBook(payload);

      setModal(false);
      resetForm();
      load();
    } catch (e: any) {
      // Log the actual exact error message from Django to your console so you can see the field violation
      console.log("Django validation errors detail:", JSON.stringify(e?.data, null, 2));
      
      const msg = e?.data?.isbn?.[0] ?? e?.data?.title?.[0] ?? e?.data?.detail ?? 'Operation failed.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item: any) => {
    confirm(
      'Confirm Delete',
      `Permanently remove "${item.title}" from the catalog?`,
      async () => {
        setDeletingId(item.id);
        try {
          await deleteBook(item.id);
          setItems((prev) => prev.filter((i) => i.id !== item.id));
        } catch {
          Alert.alert('Error', 'Delete failed. This book may be linked to an active loan.');
        } finally {
          setDeletingId(null);
        }
      }
    );
  };

  const filtered = items.filter((b) => {
    const matchSearch =
      b.title?.toLowerCase().includes(search.toLowerCase()) ||
      b.author_name?.toLowerCase().includes(search.toLowerCase()) ||
      b.isbn?.toLowerCase().includes(search.toLowerCase());
    const matchAvail =
      filterAvail === 'all'       ? true :
      filterAvail === 'available' ? b.available :
      !b.available;
    return matchSearch && matchAvail;
  });

  const cols    = width > 1024 ? 3 : width > 640 ? 2 : 1;
  const GAP     = 16;
  const PADDING = width > 768 ? 48 : 32;
  const cardW   = (width - PADDING - GAP * (cols - 1)) / cols;

  if (loading) return <Loading />;

  return (
    <SidebarLayout currentScreen="Books">
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
            <Text style={s.headerTitle}>Books ({filtered.length})</Text>
            <TouchableOpacity
              style={s.addButton}
              activeOpacity={0.8}
              onPress={() => { resetForm(); setModal(true); }}
            >
              <Feather name="plus" size={16} color="#F4EFE0" />
              <Text style={s.addButtonText}>Add Book</Text>
            </TouchableOpacity>
          </View>

          <View style={s.toolbar}>
            <View style={s.searchWrap}>
              <Feather name="search" size={14} color="#A1927F" style={{ marginRight: 6 }} />
              <TextInput
                style={s.searchInput}
                placeholder="Search title, author, ISBN…"
                placeholderTextColor="#A1927F"
                value={search}
                onChangeText={setSearch}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Feather name="x" size={14} color="#A1927F" />
                </TouchableOpacity>
              )}
            </View>
            <View style={s.filterRow}>
              {(['all', 'available', 'borrowed'] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[s.filterTab, filterAvail === f && s.filterTabActive]}
                  onPress={() => setFilterAvail(f)}
                >
                  <Text style={[s.filterTxt, filterAvail === f && s.filterTxtActive]}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {filtered.length === 0 && <Empty text="No books found." />}

          <View style={s.gridContainer}>
            {filtered.map((item) => {
              const avail = item.available;
              const badge = avail ? AVAIL_COLORS.available : AVAIL_COLORS.on_loan;
              return (
                <Card key={item.id} style={{ ...s.customCard, width: cardW }}>
                  <View style={s.cardContent}>
                    {/* Cover Image */}
                    <View style={s.coverSection}>
                      {/* 🎯 FIX: Changed item.cover_image_url to item.cover_image */}
                      {item.cover_image ? (
                        <Image source={{ uri: item.cover_image }} style={s.coverThumb} />
                      ) : (
                        <View style={s.coverPlaceholder}>
                          <Feather name="image" size={24} color="#C4A77D" />
                        </View>
                      )}
                      <View style={s.coverInfo}>
                        <View style={[s.availPill, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                          <Text style={[s.availTxt, { color: badge.text }]}>
                            {avail ? 'Available' : 'On Loan'}
                          </Text>
                        </View>
                        <Text style={s.itemTitle} numberOfLines={2}>{item.title}</Text>
                      </View>
                    </View>

                    <View style={s.cardInfo}>
                      <View style={s.metaRow}>
                        <Feather name="user" size={11} color="#A1927F" />
                        <Text style={s.itemMeta} numberOfLines={1}>{item.author_name ?? '—'}</Text>
                      </View>
                      <View style={s.metaRow}>
                        <Feather name="hash" size={11} color="#A1927F" />
                        <Text style={s.itemMeta}>{item.isbn ?? '—'}</Text>
                      </View>
                      {item.category_name && (
                        <View style={s.metaRow}>
                          <Feather name="tag" size={11} color="#A1927F" />
                          <Text style={s.itemMeta}>{item.category_name}</Text>
                        </View>
                      )}
                      {item.department_name && (
                        <View style={s.metaRow}>
                          <Feather name="briefcase" size={11} color="#A1927F" />
                          <Text style={s.itemMeta}>{item.department_name}</Text>
                        </View>
                      )}
                      {item.publication_year && (
                        <View style={s.metaRow}>
                          <Feather name="calendar" size={11} color="#A1927F" />
                          <Text style={s.itemMeta}>{item.publication_year}</Text>
                        </View>
                      )}
                    </View>

                    <View style={s.cardActions}>
                      <TouchableOpacity
                        style={s.actionButton}
                        activeOpacity={0.7}
                        onPress={() => {
                          setEditingItem(item);
                          setForm({
                            title:            item.title ?? '',
                            isbn:             item.isbn ?? '',
                            publication_year: item.publication_year?.toString() ?? '',
                            author:           item.author?.toString() ?? '',
                            category:         item.category?.toString() ?? '',
                            department:       item.department?.toString() ?? '',
                            description:      item.description ?? '',
                            available:        item.available ?? true,
                            // 🎯 FIX: Changed item.cover_image_url to item.cover_image
                            cover_image:      item.cover_image ?? null,
                            cover_image_file: null,
                          });
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
                        {deletingId === item.id
                          ? <ActivityIndicator size="small" color="#C53030" />
                          : <Feather name="trash-2" size={14} color="#C53030" />
                        }
                      </TouchableOpacity>
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        </ScrollView>

        <Modal
          visible={modal}
          animationType="fade"
          transparent
          onRequestClose={() => { setModal(false); resetForm(); }}
        >
          <View style={s.modalOverlay}>
            <View style={s.sheet}>
              <View style={s.sheetHeader}>
                <Text style={s.sheetTitle}>
                  {editingItem ? 'EDIT BOOK' : 'ADD NEW BOOK'}
                </Text>
                <TouchableOpacity onPress={() => { setModal(false); resetForm(); }}>
                  <Feather name="x" size={18} color="#281711" />
                </TouchableOpacity>
              </View>
              <View style={s.sheetDivider} />

              <ScrollView showsVerticalScrollIndicator={false} style={s.modalScroll}>
                
                {/* Cover Image Upload */}
                <View style={s.modalInputWrapper}>
                  <Text style={s.modalInputLabel}>Book Cover</Text>
                  <TouchableOpacity style={s.imagePickerBtn} onPress={pickImage}>
                    {form.cover_image ? (
                      <Image source={{ uri: form.cover_image }} style={s.imagePreview} />
                    ) : (
                      <View style={s.imagePlaceholder}>
                        <Feather name="upload" size={24} color="#A1927F" />
                        <Text style={s.imagePlaceholderText}>Tap to upload cover image</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  {form.cover_image && (
                    <TouchableOpacity 
                      style={s.removeImageBtn} 
                      onPress={() => setForm({ ...form, cover_image: null, cover_image_file: null })}
                    >
                      <Feather name="x-circle" size={16} color="#C53030" />
                      <Text style={s.removeImageText}>Remove Image</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={s.modalInputWrapper}>
                  <Text style={s.modalInputLabel}>Title *</Text>
                  <View style={s.customInputContainer}>
                    <TextInput
                      value={form.title}
                      onChangeText={(v) => setForm({ ...form, title: v })}
                      placeholder="e.g. Noli Me Tangere"
                      placeholderTextColor="#A1927F"
                      style={s.customInnerInput}
                    />
                  </View>
                </View>

                <View style={s.modalInputWrapper}>
                  <Text style={s.modalInputLabel}>ISBN *</Text>
                  <View style={s.customInputContainer}>
                    <TextInput
                      value={form.isbn}
                      onChangeText={(v) => setForm({ ...form, isbn: v })}
                      placeholder="e.g. 978-971-10-1111-1"
                      placeholderTextColor="#A1927F"
                      style={s.customInnerInput}
                    />
                  </View>
                </View>

                <View style={s.modalInputWrapper}>
                  <Text style={s.modalInputLabel}>Availability Status</Text>
                  <TouchableOpacity
                    style={[s.toggleContainer, form.available ? s.toggleActive : s.toggleInactive]}
                    activeOpacity={0.8}
                    onPress={() => setForm({ ...form, available: !form.available })}
                  >
                    <Feather name={form.available ? "check-square" : "square"} size={16} color={form.available ? "#F4EFE0" : "#281711"} />
                    <Text style={[s.toggleText, { color: form.available ? "#F4EFE0" : "#281711" }]}>
                      {form.available ? "Marked as Available" : "Marked as On Loan / Unavailable"}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={s.modalInputWrapper}>
                  <Text style={s.modalInputLabel}>Publication Year</Text>
                  <View style={s.customInputContainer}>
                    <TextInput
                      value={form.publication_year}
                      onChangeText={(v) => setForm({ ...form, publication_year: v })}
                      placeholder="e.g. 1887"
                      placeholderTextColor="#A1927F"
                      keyboardType="numeric"
                      style={s.customInnerInput}
                    />
                  </View>
                </View>

                <View style={s.modalInputWrapper}>
                  <Text style={s.modalInputLabel}>Author ID</Text>
                  <View style={s.customInputContainer}>
                    <TextInput
                      value={form.author}
                      onChangeText={(v) => setForm({ ...form, author: v })}
                      placeholder="Enter author ID"
                      placeholderTextColor="#A1927F"
                      keyboardType="numeric"
                      style={s.customInnerInput}
                    />
                  </View>
                  {authors.length > 0 && (
                    <View style={s.refList}>
                      {authors.slice(0, 5).map((a) => (
                        <TouchableOpacity key={a.id} style={s.refItem} onPress={() => setForm({ ...form, author: String(a.id) })}>
                          <Text style={s.refTxt}>{a.id} — {a.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                <View style={s.modalInputWrapper}>
                  <Text style={s.modalInputLabel}>Category ID</Text>
                  <View style={s.customInputContainer}>
                    <TextInput
                      value={form.category}
                      onChangeText={(v) => setForm({ ...form, category: v })}
                      placeholder="Enter category ID"
                      placeholderTextColor="#A1927F"
                      keyboardType="numeric"
                      style={s.customInnerInput}
                    />
                  </View>
                  {categories.length > 0 && (
                    <View style={s.refList}>
                      {categories.slice(0, 5).map((c) => (
                        <TouchableOpacity key={c.id} style={s.refItem} onPress={() => setForm({ ...form, category: String(c.id) })}>
                          <Text style={s.refTxt}>{c.id} — {c.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                <View style={s.modalInputWrapper}>
                  <Text style={s.modalInputLabel}>Department ID</Text>
                  <View style={s.customInputContainer}>
                    <TextInput
                      value={form.department}
                      onChangeText={(v) => setForm({ ...form, department: v })}
                      placeholder="Enter department ID"
                      placeholderTextColor="#A1927F"
                      keyboardType="numeric"
                      style={s.customInnerInput}
                    />
                  </View>
                  {departments.length > 0 && (
                    <View style={s.refList}>
                      {departments.slice(0, 5).map((d) => (
                        <TouchableOpacity key={d.id} style={s.refItem} onPress={() => setForm({ ...form, department: String(d.id) })}>
                          <Text style={s.refTxt}>{d.id} — {d.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                <View style={s.modalInputWrapper}>
                  <Text style={s.modalInputLabel}>Description</Text>
                  <View style={s.customInputContainer}>
                    <TextInput
                      value={form.description}
                      onChangeText={(v) => setForm({ ...form, description: v })}
                      placeholder="Brief synopsis or notes…"
                      placeholderTextColor="#A1927F"
                      multiline
                      numberOfLines={3}
                      style={[s.customInnerInput, s.customInnerInputMultiline]}
                    />
                  </View>
                </View>

              </ScrollView>

              <View style={s.modalBtns}>
                <TouchableOpacity style={s.cancelBtnTouch} onPress={() => { setModal(false); resetForm(); }}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <Btn
                  label={editingItem ? 'UPDATE' : 'SAVE RECORD'}
                  onPress={handleSave}
                  loading={saving || uploadingImage}
                />
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SidebarLayout>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: '#ECE7D1' },
  inner: { paddingBottom: 60 },

  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderColor: '#E8E4D9',
    paddingBottom: 16,
  },
  headerTitle: { color: '#281711', fontSize: 15, fontWeight: '700', fontFamily: Fonts.baskervilleBold },
  addButton: { backgroundColor: '#281711', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  addButtonText: { fontFamily: Fonts.sans, color: '#F4EFE0', fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },

  toolbar: { marginBottom: 20, gap: 10 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCD4C4', borderRadius: 0, paddingHorizontal: 12, paddingVertical: 8 },
  searchInput: { flex: 1, fontSize: 13, color: '#281711', fontFamily: Fonts.sans },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterTab: { paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: '#DCD4C4', backgroundColor: '#FFFFFF' },
  filterTabActive: { backgroundColor: '#281711', borderColor: '#281711' },
  filterTxt: { fontSize: 11, fontWeight: '600', color: '#706251', fontFamily: Fonts.sans },
  filterTxtActive: { color: '#F4EFE0' },

  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, width: '100%' },
  customCard: { backgroundColor: '#FFFDF1', borderWidth: 1, borderColor: '#412D15', borderRadius: 0, minWidth: 260 },
  cardContent: { flex: 1, padding: 18, justifyContent: 'space-between' },
  coverSection: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  coverThumb: { width: 60, height: 85, resizeMode: 'cover', borderWidth: 1, borderColor: '#E8DCC8' },
  coverPlaceholder: { width: 60, height: 85, backgroundColor: '#F8F4EC', borderWidth: 1, borderColor: '#E8DCC8', justifyContent: 'center', alignItems: 'center' },
  coverInfo: { flex: 1 },
  cardInfo: { marginBottom: 14 },
  availPill: { alignSelf: 'flex-start', borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 10 },
  availTxt: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  itemTitle: { color: '#281711', fontFamily: Fonts.baskervilleBold, fontSize: 16, lineHeight: 22, marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  itemMeta: { color: '#4A3E3D', fontFamily: Fonts.sans, fontSize: 12, lineHeight: 17, flex: 1 },
  cardActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, borderTopWidth: 1, borderColor: '#F3F1EC', paddingTop: 12 },
  actionButton: { width: 32, height: 32, backgroundColor: '#F4F1EA', justifyContent: 'center', alignItems: 'center', borderRadius: 0 },
  deleteActionButton: { backgroundColor: '#FCE8E6' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(40, 23, 17, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  sheet: { backgroundColor: '#F5F1E6', borderWidth: 1, borderColor: '#DCD4C4', borderRadius: 0, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { color: '#281711', fontFamily: Fonts.baskervilleBold, fontSize: 14, letterSpacing: 1.5 },
  sheetDivider: { height: 1, backgroundColor: '#DCD4C4', marginTop: 12, marginBottom: 20 },
  modalScroll: { marginBottom: 12 },

  modalInputWrapper: { marginBottom: 16 },
  modalInputLabel: { fontFamily: Fonts.sans, fontSize: 12, color: '#3C2F2F', marginBottom: 6, fontWeight: '600' },
  customInputContainer: { borderWidth: 1, borderColor: '#DCD4C4', backgroundColor: '#FFFFFF', borderRadius: 0, minHeight: 40, paddingHorizontal: 4, justifyContent: 'center' },
  customInnerInput: { fontFamily: Fonts.sans, fontSize: 14, color: '#281711', paddingLeft: 8, backgroundColor: 'transparent', borderWidth: 0, height: 40 },
  customInnerInputMultiline: { height: 80, paddingTop: 10, textAlignVertical: 'top' },

  toggleContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, height: 42, paddingHorizontal: 12, borderRadius: 0 },
  toggleActive: { backgroundColor: '#281711', borderColor: '#281711' },
  toggleInactive: { backgroundColor: '#FFFFFF', borderColor: '#DCD4C4' },
  toggleText: { fontFamily: Fonts.sans, fontSize: 13, fontWeight: '600' },

  refList: { marginTop: 6, borderWidth: 1, borderColor: '#DCD4C4', backgroundColor: '#FFFDF6' },
  refItem: { paddingHorizontal: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#EAE7DF' },
  refTxt: { fontFamily: Fonts.sans, fontSize: 12, color: '#4A3E3D' },

  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 12 },
  cancelBtnTouch: { flex: 1, borderWidth: 1, borderColor: '#281711', borderRadius: 0, height: 42, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
  cancelBtnText: { fontFamily: Fonts.sans, color: '#281711', fontSize: 12, fontWeight: '600' },

  imagePickerBtn: { width: '100%', minHeight: 120, borderWidth: 1, borderColor: '#DCD4C4', backgroundColor: '#FFFFFF', borderRadius: 0, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  imagePreview: { width: '100%', height: 150, resizeMode: 'cover' },
  imagePlaceholder: { padding: 24, alignItems: 'center', gap: 8 },
  imagePlaceholderText: { fontFamily: Fonts.sans, fontSize: 12, color: '#A1927F' },
  removeImageBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, alignSelf: 'flex-end' },
  removeImageText: { fontFamily: Fonts.sans, fontSize: 11, color: '#C53030' },
});