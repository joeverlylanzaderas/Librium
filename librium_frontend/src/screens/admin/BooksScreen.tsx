import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, Modal, TextInput,
  RefreshControl, TouchableOpacity, ActivityIndicator, Image,
  useWindowDimensions, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { Card, Btn, Empty, Loading } from '../../components/UI';
import { useAlert } from '../../components/AlertProvider';
import { useAutoRefreshOnFocus } from '../../hooks/useAutoRefreshOnFocus';
import { Fonts } from '../../constants/theme';
import { AdminStackParamList } from '../../navigation/AppNavigator';
import {
  getBooks, createBook, updateBook, deleteBook,
  getAuthors, getCategories, getDepartments,
} from '../../services/api';

type Props = {
  navigation: NativeStackNavigationProp<AdminStackParamList, 'Books'>;
};

const AVAIL_COLORS = {
  available: { bg: '#E6F4EA', text: '#137333', border: '#B7DFC4' },
  on_loan:   { bg: '#FCE8E6', text: '#8A2B2B', border: '#F5C2BC' },
};

export default function BooksScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const { showConfirm } = useAlert();
  
  const confirmModal = (title: string, message: string, onConfirm: () => void) => {
    showConfirm(title, message, onConfirm, { confirmText: 'Delete', cancelText: 'Cancel' });
  };

  // Responsive design layout boundaries
  const isMobile = width < 600;
  const isTablet = width >= 600 && width < 1024;

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
  
  const [expandedId, setExpandedId] = useState<number | null>(null);

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

  useAutoRefreshOnFocus(load);

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

    if (Platform.OS === 'web') {
      try {
        const responseBlob = await fetch(form.cover_image_file.uri);
        const fileBlob = await responseBlob.blob();
        data.append('file', fileBlob, form.cover_image_file.name);
      } catch (blobError) {
        
        setUploadingImage(false);
        return null;
      }
    } else {
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
        headers: { 'Accept': 'application/json' },
      });

      const responseText = await response.text(); 
      if (!response.ok) throw new Error(`Upload failed (${response.status})`);

      const dataJson = JSON.parse(responseText);
      return dataJson.secure_url;
    } catch (error: any) {
      
      Alert.alert('Upload Failed', 'Could not upload image. Please try again.');
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
      const msg = e?.data?.isbn?.[0] ?? e?.data?.title?.[0] ?? e?.data?.detail ?? 'Operation failed.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item: any) => {
    confirmModal(
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

  const toggleExpandRow = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
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

  if (loading) return <Loading />;

  // Typography scales mapped selectively to layout metrics
  const computedHeaderFontSize = isMobile ? 14 : isTablet ? 16 : 18;
  const computedThFontSize     = isMobile ? 10 : 11;
  const computedTdFontSize     = isMobile ? 11 : 12;
  const computedTitleFontSize  = isMobile ? 12 : 13;
  const computedRowPadding     = isMobile ? 10 : 12;
  const dynamicStatusWidth     = isMobile ? 68 : 75;

  return (
    <View style={s.root}>
      <View style={[s.inner, { padding: isMobile ? 12 : 20, flex: 1 }]}>
        
        {/* Header Action Row */}
        <View style={s.headerContainer}>
          <Text style={[s.headerTitle, { fontSize: computedHeaderFontSize }]}>
            Books Catalog ({filtered.length})
          </Text>
          <TouchableOpacity
            style={[s.addButton, { paddingVertical: isMobile ? 8 : 10, paddingHorizontal: isMobile ? 12 : 16 }]}
            activeOpacity={0.8}
            onPress={() => { resetForm(); setModal(true); }}
          >
            <Feather name="plus" size={isMobile ? 14 : 16} color="#F4EFE0" />
            <Text style={[s.addButtonText, { fontSize: isMobile ? 11 : 12 }]}>Add Book</Text>
          </TouchableOpacity>
        </View>

        {/* Search and Filters */}
        <View style={s.toolbar}>
          <View style={s.searchWrap}>
            <Feather name="search" size={14} color="#A1927F" style={{ marginRight: 6 }} />
            <TextInput
              style={s.searchInput}
              placeholder="Search catalog…"
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
            {((['all', 'available', 'borrowed'] as const)).map((f) => (
              <TouchableOpacity
                key={f}
                style={[s.filterTab, filterAvail === f && s.filterTabActive, { paddingHorizontal: isMobile ? 10 : 14 }]}
                onPress={() => setFilterAvail(f)}
              >
                <Text style={[s.filterTxt, filterAvail === f && s.filterTxtActive, { fontSize: isMobile ? 10 : 11 }]}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {filtered.length === 0 && <Empty text="No books found." />}

        {/* Data Table */}
        {filtered.length > 0 && (
          <View style={s.tableContainer}>
            <ScrollView 
              nestedScrollEnabled
              stickyHeaderIndices={[0]} 
              showsVerticalScrollIndicator={true}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => { setRefreshing(true); load(); }}
                  tintColor="#281711"
                />
              }
            >
              {/* Table Sticky Header Row */}
              <View style={[s.tableHeaderRow, { paddingVertical: computedRowPadding }]}>
                {!isMobile && <Text style={[s.thText, s.colCover]}></Text>}
                <Text style={[s.thText, s.colTitle, { fontSize: computedThFontSize }]}>Title</Text>
                <Text style={[s.thText, s.colAuthor, { fontSize: computedThFontSize }]}>Author</Text>
                {!isMobile && <Text style={[s.thText, s.colIsbn, { fontSize: computedThFontSize }]}>ISBN</Text>}
                <Text style={[s.thText, { fontSize: computedThFontSize, width: dynamicStatusWidth }]}>Status</Text>
                <Text style={[s.thText, s.colArrow]} />
              </View>

              {/* Table Body Content Rows */}
              {filtered.map((item) => {
                const isExpanded = expandedId === item.id;
                const badge = item.available ? AVAIL_COLORS.available : AVAIL_COLORS.on_loan;

                return (
                  <View key={item.id} style={[s.rowGroup, isExpanded && s.rowGroupActive]}>
                    
                    <TouchableOpacity 
                      style={[s.tableRow, { paddingVertical: computedRowPadding }]} 
                      activeOpacity={0.7} 
                      onPress={() => toggleExpandRow(item.id)}
                    >
                      {/* 1. Cover Column: Hidden completely on Mobile viewports */}
                      {!isMobile && (
                        <View style={s.colCover}>
                          {item.cover_image ? (
                            <Image source={{ uri: item.cover_image }} style={s.tableCoverThumb} />
                          ) : (
                            <View style={s.tableCoverPlaceholder}>
                              <Feather name="image" size={14} color="#C4A77D" />
                            </View>
                          )}
                        </View>
                      )}

                      {/* 2. Main Text Info Fields */}
                      <Text style={[s.tdText, s.colTitle, s.titleStyle, { fontSize: computedTitleFontSize }]}>
                        {item.title}
                      </Text>
                      <Text style={[s.tdText, s.colAuthor, { fontSize: computedTdFontSize }]}>
                        {item.author_name ?? '—'}
                      </Text>

                      {/* 3. ISBN Column: Hidden completely on Mobile viewports */}
                      {!isMobile && (
                        <Text style={[s.tdText, s.colIsbn, { fontSize: computedTdFontSize }]}>
                          {item.isbn ?? '—'}
                        </Text>
                      )}

                      {/* 4. Status Pill */}
                      <View style={{ width: dynamicStatusWidth, alignItems: 'flex-start' }}>
                        <View style={[s.tablePill, { backgroundColor: badge.bg, borderColor: badge.border, paddingHorizontal: isMobile ? 4 : 6 }]}>
                          <Text style={[s.tablePillTxt, { color: badge.text, fontSize: isMobile ? 8 : 8 }]}>
                            {item.available ? 'Available' : 'On Loan'}
                          </Text>
                        </View>
                      </View>

                      {/* 5. Toggle Indicator Arrow */}
                      <View style={s.colArrow}>
                        <Feather 
                          name={isExpanded ? "chevron-up" : "chevron-down"} 
                          size={isMobile ? 14 : 16} 
                          color="#706251" 
                        />
                      </View>
                    </TouchableOpacity>

                    {/* Collapsible Panel Section */}
                    {isExpanded && (
                      <View style={s.expandedPanel}>
                        <View style={s.expandedInner}>
                          
                          {/* Left Panel Meta (Includes dynamic cover thumb + ISBN for Mobile) */}
                          <View style={s.panelMetaBlock}>
                            <Text style={s.panelSectionTitle}>Book Details</Text>
                            
                            {/* Display cover image in the accordion ONLY if on Mobile */}
                            {isMobile && (
                              <View style={{ marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                {item.cover_image ? (
                                  <Image source={{ uri: item.cover_image }} style={{ width: 36, height: 50, resizeMode: 'cover', borderWidth: 1, borderColor: '#DCD4C4' }} />
                                ) : (
                                  <View style={{ width: 36, height: 50, backgroundColor: '#F4F1EA', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#DCD4C4' }}>
                                    <Feather name="image" size={14} color="#C4A77D" />
                                  </View>
                                )}
                                <View>
                                  <Text style={[s.boldLabel, { fontSize: 11 }]}>Catalog Thumbnail</Text>
                                  <Text style={{ fontSize: 10, color: '#706251' }}>Cover Art File</Text>
                                </View>
                              </View>
                            )}

                            {isMobile && (
                              <View style={s.metaRow}>
                                <Feather name="hash" size={11} color="#A1927F" />
                                <Text style={[s.itemMeta, { fontSize: computedTdFontSize }]}><Text style={s.boldLabel}>ISBN:</Text> {item.isbn ?? '—'}</Text>
                              </View>
                            )}
                            {item.category_name && (
                              <View style={s.metaRow}>
                                <Feather name="tag" size={11} color="#A1927F" />
                                <Text style={[s.itemMeta, { fontSize: computedTdFontSize }]}><Text style={s.boldLabel}>Category:</Text> {item.category_name}</Text>
                              </View>
                            )}
                            {item.department_name && (
                              <View style={s.metaRow}>
                                <Feather name="briefcase" size={11} color="#A1927F" />
                                <Text style={[s.itemMeta, { fontSize: computedTdFontSize }]}><Text style={s.boldLabel}>Dept:</Text> {item.department_name}</Text>
                              </View>
                            )}
                            {item.publication_year && (
                              <View style={s.metaRow}>
                                <Feather name="calendar" size={11} color="#A1927F" />
                                <Text style={[s.itemMeta, { fontSize: computedTdFontSize }]}><Text style={s.boldLabel}>Year:</Text> {item.publication_year}</Text>
                              </View>
                            )}
                          </View>

                          {/* Center Description Synopsis */}
                          <View style={s.panelDescBlock}>
                            <Text style={s.panelSectionTitle}>Synopsis / Notes</Text>
                            <Text style={[s.panelDescTxt, { fontSize: computedTdFontSize, lineHeight: isMobile ? 15 : 18 }]}>
                              {item.description && item.description.trim() !== '' 
                                ? item.description 
                                : 'No summary or contextual descriptions have been filed for this entry yet.'}
                            </Text>
                          </View>

                          {/* Action Controls Section */}
                          <View style={s.panelActionBlock}>
                            <Text style={s.panelSectionTitle}>Management</Text>
                            <View style={s.panelActionButtonsRow}>
                              <TouchableOpacity
                                style={s.panelBtnEdit}
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
                                    cover_image:      item.cover_image ?? null,
                                    cover_image_file: null,
                                  });
                                  setModal(true);
                                }}
                              >
                                <Feather name="edit" size={12} color="#F4EFE0" />
                                <Text style={s.panelBtnEditTxt}>Edit Book</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={s.panelBtnDelete}
                                activeOpacity={0.7}
                                onPress={() => handleDelete(item)}
                                disabled={deletingId === item.id}
                              >
                                {deletingId === item.id
                                  ? <ActivityIndicator size="small" color="#C53030" />
                                  : <>
                                      <Feather name="trash-2" size={12} color="#C53030" />
                                      <Text style={s.panelBtnDeleteTxt}>Delete</Text>
                                    </>
                                }
                              </TouchableOpacity>
                            </View>
                          </View>

                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Entry Input Form Modal Sheet */}
      <Modal
        visible={modal}
        animationType="fade"
        transparent
        onRequestClose={() => { setModal(false); resetForm(); }}
      >
        <View style={s.modalOverlay}>
          <View style={[s.sheet, { padding: isMobile ? 16 : 24 }]}>
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
                    {form.available ? "Marked as Available" : "Marked as On Loan"}
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
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: '#ECE7D1' },
  inner: { paddingBottom: 16 },

  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderColor: '#DCD4C4',
    paddingBottom: 16,
  },
  headerTitle: { color: '#281711', fontWeight: '700', fontFamily: Fonts.baskervilleBold },
  addButton: { backgroundColor: '#281711', borderRadius: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  addButtonText: { fontFamily: Fonts.sans, color: '#F4EFE0', fontWeight: '600', letterSpacing: 0.5 },

  toolbar: { marginBottom: 20, gap: 10 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCD4C4', borderRadius: 0, paddingHorizontal: 12, paddingVertical: 8 },
  searchInput: { flex: 1, fontSize: 13, color: '#281711', fontFamily: Fonts.sans },
  filterRow: { flexDirection: 'row', gap: 6 },
  filterTab: { paddingVertical: 6, borderWidth: 1, borderColor: '#DCD4C4', backgroundColor: '#FFFFFF' },
  filterTabActive: { backgroundColor: '#281711', borderColor: '#281711' },
  filterTxt: { fontWeight: '600', color: '#706251', fontFamily: Fonts.sans },
  filterTxtActive: { color: '#F4EFE0' },

  tableContainer: {
    flex: 1,
    backgroundColor: '#FFFDF1',
    borderWidth: 1,
    borderColor: '#412D15',
    borderRadius: 0,
    overflow: 'hidden',
    width: '100%',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#281711',
    paddingHorizontal: 12,
    alignItems: 'center',
    width: '100%',
  },
  thText: {
    color: '#F4EFE0',
    fontFamily: Fonts.sans,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  rowGroup: {
    borderBottomWidth: 1,
    borderColor: '#EAE2CD',
    backgroundColor: '#FFFDF1',
    width: '100%',
  },
  rowGroupActive: {
    backgroundColor: '#FAF5E3',
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    alignItems: 'center',
    width: '100%',
  },
  tdText: {
    color: '#3C2F2F',
    fontFamily: Fonts.sans,
    flexWrap: 'wrap',
  },
  titleStyle: {
    fontFamily: Fonts.baskervilleBold,
    color: '#281711',
  },
  
  /* Shared flex weights that dynamically absorb row width gracefully */
  colCover:  { width: 45, justifyContent: 'center' },
  colTitle:  { flex: 3.5, paddingRight: 6 },
  colAuthor: { flex: 2.5, paddingRight: 6 },
  colIsbn:   { flex: 2, paddingRight: 4 },
  colArrow:  { width: 20, alignItems: 'flex-end' },

  tableCoverThumb: { width: 32, height: 44, resizeMode: 'cover', borderWidth: 1, borderColor: '#DCD4C4' },
  tableCoverPlaceholder: { width: 32, height: 44, backgroundColor: '#F4F1EA', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#DCD4C4' },
  
  tablePill: { alignSelf: 'flex-start', borderWidth: 1, paddingVertical: 2 },
  tablePillTxt: { fontWeight: '700', letterSpacing: 0.1 },

  /* Accordion Expansion Panel Details layout adjustments */
  expandedPanel: {
    backgroundColor: '#F7F3E3',
    borderTopWidth: 1,
    borderColor: '#E6DCBF',
    padding: 12,
    width: '100%',
  },
  expandedInner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  panelSectionTitle: {
    fontSize: 9,
    fontWeight: '700',
    color: '#706251',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  panelMetaBlock: {
    flex: 1,
    minWidth: 145,
  },
  panelDescBlock: {
    flex: 1.5,
    minWidth: 180,
  },
  panelActionBlock: {
    width: '100%',
    marginTop: 4,
  },
  boldLabel: {
    fontWeight: '600',
    color: '#281711',
  },
  panelDescTxt: {
    fontFamily: Fonts.sans,
    color: '#4A3E3D',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  itemMeta: { color: '#4A3E3D', fontFamily: Fonts.sans, flex: 1 },
  
  panelActionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  panelBtnEdit: {
    flex: 1,
    backgroundColor: '#4A3E3D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
  },
  panelBtnEditTxt: {
    color: '#F4EFE0',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: Fonts.sans,
  },
  panelBtnDelete: {
    flex: 1,
    backgroundColor: '#FCE8E6',
    borderWidth: 1,
    borderColor: '#F5C2BC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
  },
  panelBtnDeleteTxt: {
    color: '#C53030',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: Fonts.sans,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(40, 23, 17, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  sheet: { backgroundColor: '#F5F1E6', borderWidth: 1, borderColor: '#DCD4C4', borderRadius: 0, width: '100%', maxWidth: 480, maxHeight: '90%' },
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