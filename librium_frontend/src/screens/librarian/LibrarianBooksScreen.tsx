//  LibrarianBooksScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, Modal, TextInput,
  RefreshControl, TouchableOpacity, ActivityIndicator, Image,
  useWindowDimensions, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { Card, Btn, Empty, Loading, Badge, C } from '../../components/UI';
import { useAlert } from '../../components/AlertProvider';
import { Fonts } from '../../constants/theme';
import {
  getBooks, createBook, updateBook, deleteBook,
  getAuthors, getCategories, getDepartments,
} from '../../services/api';

const AVAIL_COLORS = {
  available: { bg: '#E6F4EA', text: '#137333', border: '#B7DFC4' },
  on_loan:   { bg: '#FCE8E6', text: '#8A2B2B', border: '#F5C2BC' },
};

export default function LibrarianBooksScreen() {
  const { width } = useWindowDimensions();
  const { showConfirm } = useAlert();

  const confirmModal = (title: string, message: string, onConfirm: () => void) => {
    showConfirm(title, message, onConfirm, { confirmText: 'Delete', cancelText: 'Cancel' });
  };

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

  // Search filter query string states for form dropdown elements
  const [authorSearch, setAuthorSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [departmentSearch, setDepartmentSearch] = useState('');

  // Floating Dropdown Open/Close View States
  const [showAuthorDropdown, setShowAuthorDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);

  // Expanded Row Tracking State
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});

  const [search, setSearch]         = useState('');
  const [filterAvail, setFilterAvail] = useState<'all' | 'available' | 'borrowed'>('all');

  const [form, setForm] = useState({
    title:            '',
    isbn:             '',
    publication_year: '',
    author:           '', // Stores item ID directly
    category:         '', // Stores item ID directly
    department:       '', // Stores item ID directly
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
    } catch (e) {
      
      Alert.alert('Error', 'Failed to load book catalog.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleRow = (id: number) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

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
    setAuthorSearch('');
    setCategorySearch('');
    setDepartmentSearch('');
    setShowAuthorDropdown(false);
    setShowCategoryDropdown(false);
    setShowDepartmentDropdown(false);
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

  // Derived filter functions for input search dropdown panels
  const filteredAuthors = authors.filter(a => 
    a.name?.toLowerCase().includes(authorSearch.toLowerCase())
  );
  const filteredCategories = categories.filter(c => 
    c.name?.toLowerCase().includes(categorySearch.toLowerCase())
  );
  const filteredDepartments = departments.filter(d => 
    d.name?.toLowerCase().includes(departmentSearch.toLowerCase())
  );

  const isMobile = width < 640;

  if (loading) return <Loading />;

  return (
    <View style={s.root}>
      {/* Top Controls Bar */}
      <View style={s.topBar}>
        <View style={s.searchWrap}>
          <Feather name="search" size={16} color={C.muted} style={{ marginRight: 6 }} />
          <TextInput
            style={s.searchInput}
            placeholder="Search title, author, ISBN..."
            placeholderTextColor={C.muted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Feather name="x" size={16} color={C.muted} />
            </TouchableOpacity>
          )}
        </View>

        <View style={s.actionRow}>
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
          
          <TouchableOpacity
            style={s.addButton}
            activeOpacity={0.8}
            onPress={() => { resetForm(); setModal(true); }}
          >
            <Feather name="plus" size={14} color="#FFF" />
            <Text style={s.addButtonText}>Add Book</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.count}>{filtered.length} books registered</Text>
      </View>

      {/* Main Table Layout */}
      <ScrollView
        contentContainerStyle={[s.inner, { padding: width > 768 ? 24 : 12 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={C.primary}
          />
        }
      >
        {filtered.length === 0 ? (
          <Empty text="No records match your filters." />
        ) : (
          <View style={s.tableContainer}>
            {/* Table Header Row */}
            <View style={s.tableHeader}>
              <Text style={[s.thText, s.colIcon]}></Text>
              <Text style={[s.thText, s.colCover]}>Cover</Text>
              <Text style={[s.thText, s.colMainInfo]}>Title & Author</Text>
              {!isMobile && <Text style={[s.thText, s.colMeta]}>Primary Identifiers</Text>}
              <Text style={[s.thText, s.colStatus]}></Text>
            </View>

            {/* Table Body Iteration */}
            {filtered.map((item) => {
              const isOpen = !!expandedRows[item.id];
              const avail  = item.available;
              const badge  = avail ? AVAIL_COLORS.available : AVAIL_COLORS.on_loan;

              return (
                <View key={item.id} style={[s.tableRowGroup, isOpen && s.rowGroupOpen]}>
                  {/* Master Clickable Core Row */}
                  <TouchableOpacity
                    style={s.tableRow}
                    activeOpacity={0.7}
                    onPress={() => toggleRow(item.id)}
                  >
                    <View style={s.colIcon}>
                      <Feather name={isOpen ? "chevron-down" : "chevron-right"} size={16} color={C.sub} />
                    </View>

                    <View style={s.colCover}>
                      {item.cover_image ? (
                        <Image source={{ uri: item.cover_image }} style={s.tableThumb} />
                      ) : (
                        <View style={s.tableThumbPlaceholder}>
                          <Feather name="image" size={12} color={C.muted} />
                        </View>
                      )}
                    </View>

                    <View style={s.colMainInfo}>
                      <Text style={s.rowTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={s.rowAuthor} numberOfLines={1}>{item.author_name ?? 'Unknown Author'}</Text>
                    </View>

                    {!isMobile && (
                      <View style={s.colMeta}>
                        <Text style={s.rowMetaTxt} numberOfLines={1}>ISBN: {item.isbn ?? '—'}</Text>
                        <Text style={s.rowMetaSubTxt}>Year: {item.publication_year ?? '—'}</Text>
                      </View>
                    )}

                    <View style={s.colStatus}>
                      <View style={[s.tablePill, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                        <Text style={[s.tablePillTxt, { color: badge.text }]}>
                          {avail ? 'Available' : 'Unavailable'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Secondary Collapsible Details Panel */}
                  {isOpen && (
                    <View style={s.expandedPanel}>
                      <View style={s.panelGrid}>
                        <View style={s.panelMetaBlock}>
                          <Text style={s.panelLabel}>Book Details & Relations</Text>
                          <Text style={s.panelText}><Text style={s.bold}>ISBN Code:</Text> {item.isbn ?? '—'}</Text>
                          <Text style={s.panelText}><Text style={s.bold}>Release Year:</Text> {item.publication_year ?? '—'}</Text>
                          
                          <View style={s.panelBadges}>
                            {item.category_name && <Badge label={`Category: ${item.category_name}`} color={C.primary} />}
                            {item.department_name && <Badge label={`Dept: ${item.department_name}`} color="#7C3AED" />}
                          </View>
                        </View>

                        <View style={s.panelDescBlock}>
                          <Text style={s.panelLabel}>Synopsis / Internal Notes</Text>
                          <Text style={s.panelDescText}>
                            {item.description || 'No summary overview details provided for this book.'}
                          </Text>
                        </View>

                        {/* Inline Row Action Buttons */}
                        <View style={s.panelActionsBlock}>
                          <TouchableOpacity
                            style={s.rowActionBtn}
                            activeOpacity={0.7}
                            onPress={() => {
                              setEditingItem(item);
                              
                              // Track down titles matching existing parameters to populate active inputs
                              const currentAuthor = authors.find(a => a.id === item.author);
                              const currentCat = categories.find(c => c.id === item.category);
                              const currentDept = departments.find(d => d.id === item.department);

                              setAuthorSearch(currentAuthor ? currentAuthor.name : item.author_name ?? '');
                              setCategorySearch(currentCat ? currentCat.name : item.category_name ?? '');
                              setDepartmentSearch(currentDept ? currentDept.name : item.department_name ?? '');

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
                            <Feather name="edit-2" size={12} color={C.text} />
                            <Text style={s.rowActionBtnTxt}>Modify</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[s.rowActionBtn, s.rowDeleteBtn]}
                            activeOpacity={0.7}
                            onPress={() => handleDelete(item)}
                            disabled={deletingId === item.id}
                          >
                            {deletingId === item.id ? (
                              <ActivityIndicator size="small" color={C.danger} />
                            ) : (
                              <>
                                <Feather name="trash-2" size={12} color={C.danger} />
                                <Text style={[s.rowActionBtnTxt, { color: C.danger }]}>Delete</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Form Editor Sheet Modal */}
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
                {editingItem ? 'UPDATE BOOK REGISTRY' : 'CREATE BOOK REGISTRY'}
              </Text>
              <TouchableOpacity onPress={() => { setModal(false); resetForm(); }}>
                <Feather name="x" size={18} color={C.text} />
              </TouchableOpacity>
            </View>
            <View style={s.sheetDivider} />

            {/* Configured keyboardShouldPersistTaps to prevent drop panel item taps from being absorbed */}
            <ScrollView 
              showsVerticalScrollIndicator={false} 
              style={s.modalScroll}
              keyboardShouldPersistTaps="handled"
            >
              {/* Image Input Selection */}
              <View style={s.modalInputWrapper}>
                <Text style={s.modalInputLabel}>Cover Image Asset</Text>
                <TouchableOpacity style={s.imagePickerBtn} onPress={pickImage}>
                  {form.cover_image ? (
                    <Image source={{ uri: form.cover_image }} style={s.imagePreview} />
                  ) : (
                    <View style={s.imagePlaceholder}>
                      <Feather name="upload-cloud" size={22} color={C.muted} />
                      <Text style={s.imagePlaceholderText}>Click to load new graphical image file</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {form.cover_image && (
                  <TouchableOpacity 
                    style={s.removeImageBtn} 
                    onPress={() => setForm({ ...form, cover_image: null, cover_image_file: null })}
                  >
                    <Feather name="x-circle" size={14} color={C.danger} />
                    <Text style={s.removeImageText}>Remove File</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={s.modalInputWrapper}>
                <Text style={s.modalInputLabel}>Book Title *</Text>
                <View style={s.customInputContainer}>
                  <TextInput
                    value={form.title}
                    onChangeText={(v) => setForm({ ...form, title: v })}
                    placeholder="e.g., Computer Networking"
                    placeholderTextColor={C.muted}
                    style={s.customInnerInput}
                  />
                </View>
              </View>

              <View style={s.modalInputWrapper}>
                <Text style={s.modalInputLabel}>ISBN Identifier Standard *</Text>
                <View style={s.customInputContainer}>
                  <TextInput
                    value={form.isbn}
                    onChangeText={(v) => setForm({ ...form, isbn: v })}
                    placeholder="e.g., 978-0136066989"
                    placeholderTextColor={C.muted}
                    style={s.customInnerInput}
                  />
                </View>
              </View>

              <View style={s.modalInputWrapper}>
                <Text style={s.modalInputLabel}>Availability Setting Status</Text>
                <TouchableOpacity
                  style={[s.toggleContainer, form.available ? s.toggleActive : s.toggleInactive]}
                  activeOpacity={0.8}
                  onPress={() => setForm({ ...form, available: !form.available })}
                >
                  <Feather name={form.available ? "check-circle" : "circle"} size={16} color={form.available ? "#FFF" : C.text} />
                  <Text style={[s.toggleText, { color: form.available ? "#FFF" : C.text }]}>
                    {form.available ? "Set Active / Available" : "Set Reserved / On Loan"}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={s.modalInputWrapper}>
                <Text style={s.modalInputLabel}>Publication Year</Text>
                <View style={s.customInputContainer}>
                  <TextInput
                    value={form.publication_year}
                    onChangeText={(v) => setForm({ ...form, publication_year: v })}
                    placeholder="e.g., 2021"
                    placeholderTextColor={C.muted}
                    keyboardType="numeric"
                    style={s.customInnerInput}
                  />
                </View>
              </View>

              {/* AUTHOR SEARCHABLE DROPDOWN */}
              <View style={s.modalInputWrapper}>
                <Text style={s.modalInputLabel}>Author Relationship Selection</Text>
                <View style={[s.customInputContainer, showAuthorDropdown && s.inputContainerActive]}>
                  <TextInput
                    value={authorSearch}
                    onChangeText={(v) => {
                      setAuthorSearch(v);
                      setShowAuthorDropdown(true);
                      if(v === '') setForm({ ...form, author: '' });
                    }}
                    onFocus={() => setShowAuthorDropdown(true)}
                    placeholder="Type to search authors..."
                    placeholderTextColor={C.muted}
                    style={s.customInnerInput}
                  />
                  <TouchableOpacity 
                    style={s.inputRightIcon} 
                    onPress={() => setShowAuthorDropdown(!showAuthorDropdown)}
                  >
                    <Feather name={showAuthorDropdown ? "chevron-up" : "chevron-down"} size={16} color={C.sub} />
                  </TouchableOpacity>
                </View>
                
                {showAuthorDropdown && (
                  <View style={s.dropdownContainer}>
                    <ScrollView style={s.dropdownScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                      {filteredAuthors.length === 0 ? (
                        <Text style={s.dropdownNoResult}>No matching authors found</Text>
                      ) : (
                        filteredAuthors.map((auth) => (
                          <TouchableOpacity
                            key={auth.id}
                            style={[s.dropdownItem, form.author === auth.id.toString() && s.dropdownItemActive]}
                            onPress={() => {
                              setForm({ ...form, author: auth.id.toString() });
                              setAuthorSearch(auth.name);
                              setShowAuthorDropdown(false);
                            }}
                          >
                            <Text style={[s.dropdownItemTxt, form.author === auth.id.toString() && s.dropdownItemTxtActive]}>
                              {auth.name}
                            </Text>
                            {form.author === auth.id.toString() && <Feather name="check" size={14} color={C.primary} />}
                          </TouchableOpacity>
                        ))
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* CATEGORY SEARCHABLE DROPDOWN */}
              <View style={s.modalInputWrapper}>
                <Text style={s.modalInputLabel}>Category Classification Selection</Text>
                <View style={[s.customInputContainer, showCategoryDropdown && s.inputContainerActive]}>
                  <TextInput
                    value={categorySearch}
                    onChangeText={(v) => {
                      setCategorySearch(v);
                      setShowCategoryDropdown(true);
                      if(v === '') setForm({ ...form, category: '' });
                    }}
                    onFocus={() => setShowCategoryDropdown(true)}
                    placeholder="Type to search categories..."
                    placeholderTextColor={C.muted}
                    style={s.customInnerInput}
                  />
                  <TouchableOpacity 
                    style={s.inputRightIcon} 
                    onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
                  >
                    <Feather name={showCategoryDropdown ? "chevron-up" : "chevron-down"} size={16} color={C.sub} />
                  </TouchableOpacity>
                </View>
                
                {showCategoryDropdown && (
                  <View style={s.dropdownContainer}>
                    <ScrollView style={s.dropdownScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                      {filteredCategories.length === 0 ? (
                        <Text style={s.dropdownNoResult}>No matching categories found</Text>
                      ) : (
                        filteredCategories.map((cat) => (
                          <TouchableOpacity
                            key={cat.id}
                            style={[s.dropdownItem, form.category === cat.id.toString() && s.dropdownItemActive]}
                            onPress={() => {
                              setForm({ ...form, category: cat.id.toString() });
                              setCategorySearch(cat.name);
                              setShowCategoryDropdown(false);
                            }}
                          >
                            <Text style={[s.dropdownItemTxt, form.category === cat.id.toString() && s.dropdownItemTxtActive]}>
                              {cat.name}
                            </Text>
                            {form.category === cat.id.toString() && <Feather name="check" size={14} color={C.primary} />}
                          </TouchableOpacity>
                        ))
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* DEPARTMENT SEARCHABLE DROPDOWN */}
              <View style={s.modalInputWrapper}>
                <Text style={s.modalInputLabel}>Academic Department Selection</Text>
                <View style={[s.customInputContainer, showDepartmentDropdown && s.inputContainerActive]}>
                  <TextInput
                    value={departmentSearch}
                    onChangeText={(v) => {
                      setDepartmentSearch(v);
                      setShowDepartmentDropdown(true);
                      if(v === '') setForm({ ...form, department: '' });
                    }}
                    onFocus={() => setShowDepartmentDropdown(true)}
                    placeholder="Type to search departments..."
                    placeholderTextColor={C.muted}
                    style={s.customInnerInput}
                  />
                  <TouchableOpacity 
                    style={s.inputRightIcon} 
                    onPress={() => setShowDepartmentDropdown(!showDepartmentDropdown)}
                  >
                    <Feather name={showDepartmentDropdown ? "chevron-up" : "chevron-down"} size={16} color={C.sub} />
                  </TouchableOpacity>
                </View>
                
                {showDepartmentDropdown && (
                  <View style={s.dropdownContainer}>
                    <ScrollView style={s.dropdownScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                      {filteredDepartments.length === 0 ? (
                        <Text style={s.dropdownNoResult}>No matching departments found</Text>
                      ) : (
                        filteredDepartments.map((dept) => (
                          <TouchableOpacity
                            key={dept.id}
                            style={[s.dropdownItem, form.department === dept.id.toString() && s.dropdownItemActive]}
                            onPress={() => {
                              setForm({ ...form, department: dept.id.toString() });
                              setDepartmentSearch(dept.name);
                              setShowDepartmentDropdown(false);
                            }}
                          >
                            <Text style={[s.dropdownItemTxt, form.department === dept.id.toString() && s.dropdownItemTxtActive]}>
                              {dept.name}
                            </Text>
                            {form.department === dept.id.toString() && <Feather name="check" size={14} color={C.primary} />}
                          </TouchableOpacity>
                        ))
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={s.modalInputWrapper}>
                <Text style={s.modalInputLabel}>Description / Synopsis Summary</Text>
                <View style={s.customInputContainer}>
                  <TextInput
                    value={form.description}
                    onChangeText={(v) => setForm({ ...form, description: v })}
                    placeholder="Enter descriptive metadata logs..."
                    placeholderTextColor={C.muted}
                    multiline
                    numberOfLines={3}
                    style={[s.customInnerInput, s.customInnerInputMultiline]}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtnTouch} onPress={() => { setModal(false); resetForm(); }}>
                <Text style={s.cancelBtnText}>Discard</Text>
              </TouchableOpacity>
              <Btn
                label={editingItem ? 'SAVE REVISIONS' : 'PUBLISH ENTRY'}
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
  root:  { flex: 1, backgroundColor: C.bg },
  inner: { paddingBottom: 40 },

  // Header Filters Configuration
  topBar: { backgroundColor: C.surface, padding: 14, borderBottomWidth: 1, borderBottomColor: C.border, gap: 10 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: Platform.OS === 'web' ? 10 : 6 },
  searchInput: { flex: 1, color: C.text, fontSize: 14, ...Platform.select({ web: { outlineStyle: 'none' } }) as any },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filterTab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  filterTabActive: { backgroundColor: C.primary, borderColor: C.primary },
  filterTxt: { color: C.sub, fontSize: 12, fontWeight: '600' },
  filterTxtActive: { color: '#FFF' },
  count: { color: C.muted, fontSize: 12, marginTop: 2, fontWeight: '500' },
  addButton: { backgroundColor: C.primary, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' },
  addButtonText: { color: '#FFF', fontSize: 12, fontWeight: '600' },

  // Relational Table Layout Grid System
  tableContainer: { backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', backgroundColor: C.surface, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.border, alignItems: 'center' },
  thText: { color: C.sub, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  
  tableRowGroup: { borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.card },
  rowGroupOpen: { backgroundColor: C.surface },
  tableRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },

  colIcon:     { width: 30, justifyContent: 'center' },
  colCover:    { width: 50, alignItems: 'center' },
  colMainInfo: { flex: 3, paddingHorizontal: 8, justifyContent: 'center' },
  colMeta:     { flex: 2, paddingHorizontal: 8, justifyContent: 'center' },
  colStatus:   { width: 100, alignItems: 'flex-end', justifyContent: 'center' },

  tableThumb: { width: 32, height: 46, borderRadius: 3, resizeMode: 'cover', borderWidth: 1, borderColor: C.border },
  tableThumbPlaceholder: { width: 32, height: 46, borderRadius: 3, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center' },
  
  rowTitle: { color: C.text, fontSize: 14, fontWeight: '600' },
  rowAuthor: { color: C.sub, fontSize: 12, marginTop: 1 },
  rowMetaTxt: { color: C.text, fontSize: 12 },
  rowMetaSubTxt: { color: C.muted, fontSize: 11, marginTop: 1 },

  tablePill: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  tablePillTxt: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },

  expandedPanel: { padding: 16, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border, borderBottomWidth: 1, borderBottomColor: C.border },
  panelGrid: { gap: 14 },
  panelMetaBlock: { gap: 4 },
  panelLabel: { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 },
  panelText: { fontSize: 13, color: C.text },
  bold: { fontWeight: '600', color: C.sub },
  panelBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  
  panelDescBlock: { gap: 4 },
  panelDescText: { fontSize: 13, color: C.sub, lineHeight: 18 },

  panelActionsBlock: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  rowActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg },
  rowDeleteBtn: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
  rowActionBtnTxt: { fontSize: 12, fontWeight: '600', color: C.text },

  // Dialog Overlays
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  sheet: { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 20, width: '100%', maxWidth: 460, maxHeight: '85%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { color: C.text, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  sheetDivider: { height: 1, backgroundColor: C.border, marginTop: 10, marginBottom: 16 },
  modalScroll: { marginBottom: 12 },
  modalInputWrapper: { marginBottom: 14, position: 'relative' },
  modalInputLabel: { fontSize: 12, color: C.sub, marginBottom: 4, fontWeight: '600' },
  
  customInputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 6, minHeight: 38 },
  inputContainerActive: { borderColor: C.primary },
  customInnerInput: { flex: 1, fontSize: 14, color: C.text, paddingHorizontal: 10, backgroundColor: 'transparent', borderWidth: 0, height: 38, ...Platform.select({ web: { outlineStyle: 'none' } }) as any },
  customInnerInputMultiline: { height: 70, paddingTop: 8, textAlignVertical: 'top' },
  inputRightIcon: { paddingRight: 10, height: '100%', justifyContent: 'center' },

  // Search Dropdown Styles
  dropdownContainer: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 6, marginTop: 4, maxHeight: 150, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  dropdownScroll: { maxHeight: 150 },
  dropdownItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  dropdownItemActive: { backgroundColor: '#F3F4F6' },
  dropdownItemTxt: { fontSize: 13, color: C.text },
  dropdownItemTxtActive: { fontWeight: '600', color: C.primary },
  dropdownNoResult: { padding: 12, color: C.muted, fontSize: 12, textAlign: 'center', fontStyle: 'italic' },

  toggleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, height: 38, paddingHorizontal: 12, borderRadius: 6 },
  toggleActive: { backgroundColor: C.primary, borderColor: C.primary },
  toggleInactive: { backgroundColor: C.card, borderColor: C.border },
  toggleText: { fontSize: 12, fontWeight: '600' },
  modalBtns: { flexDirection: 'row', gap: 10, paddingTop: 6 },
  cancelBtnTouch: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 6, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: C.card },
  cancelBtnText: { color: C.sub, fontSize: 13, fontWeight: '600' },
  imagePickerBtn: { width: '100%', minHeight: 110, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 6, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  imagePreview: { width: '100%', height: 140, resizeMode: 'cover' },
  imagePlaceholder: { padding: 16, alignItems: 'center', gap: 4 },
  imagePlaceholderText: { fontSize: 12, color: C.muted },
  removeImageBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, alignSelf: 'flex-end' },
  removeImageText: { fontSize: 11, color: C.danger, fontWeight: '500' },
});