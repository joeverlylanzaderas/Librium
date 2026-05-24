// admin/MembersScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, ActivityIndicator, useWindowDimensions, TextInput, Modal
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getUsers, updateUser, deleteUser, createUser } from '../../services/api';
import { Card, Empty, Loading, Btn } from '../../components/UI';
import SidebarLayout from '../../components/SidebarLayout';
import { Fonts } from '../../constants/theme';

type User = {
  id: number;
  email: string;
  username: string;
  full_name: string;
  role: 'admin' | 'librarian' | 'member';
  date_joined: string;
  profile?: {
    phone_number?: string;
    address?: string;
    birthday?: string;
    sex?: string | null;
  };
};

const confirm = (title: string, message: string, onConfirm: () => void) => {
  if (typeof window !== 'undefined') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
  } else {
    const { Alert } = require('react-native');
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: onConfirm },
    ]);
  }
};

const ROLE_THEME: Record<string, { bg: string; text: string; border: string }> = {
  admin: { bg: '#FEF3C7', text: '#D97706', border: '#FCD34D' },
  librarian: { bg: '#EDE9FE', text: '#7C3AED', border: '#DDD6FE' },
  member: { bg: '#E0F2FE', text: '#0369A1', border: '#BAE6FD' },
};

const SEX_LABEL: Record<string, string> = { M: 'Male', F: 'Female', O: 'Other' };

export default function MembersScreen() {
  const { width } = useWindowDimensions();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'librarian' | 'member'>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [mutatingId, setMutatingId] = useState<number | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formRole, setFormRole] = useState<'admin' | 'librarian' | 'member'>('member');
  const [formPassword, setFormPassword] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await getUsers();
      setUsers(data.results ?? data);
    } catch (e) {
      console.warn('Members structural registry load fault:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter((u) => {
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    const q = search.toLowerCase();
    return (
      matchRole &&
      (!q ||
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q))
    );
  });

  const openCreateModal = () => {
    setEditingUser(null);
    setFormName('');
    setFormEmail('');
    setFormUsername('');
    setFormRole('member');
    setFormPassword('');
    setModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormName(user.full_name || '');
    setFormEmail(user.email || '');
    setFormUsername(user.username || '');
    setFormRole(user.role || 'member');
    setFormPassword('');
    setModalOpen(true);
  };

  const handleSaveUser = async () => {
    if (!formEmail.trim() || !formUsername.trim() || !formName.trim()) {
      alert('Please fill out all administrative required credentials.');
      return;
    }
    if (!editingUser && !formPassword) {
      alert('Security password initialization is required for new records.');
      return;
    }

    setModalLoading(true);
    try {
      if (editingUser) {
        const updated = await updateUser(editingUser.id, {
          full_name: formName.trim(),
          username: formUsername.trim(),
          email: formEmail.trim().toLowerCase(),
          role: formRole
        });
        setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? { ...u, ...updated } : u)));
      } else {
        const created = await createUser({
          full_name: formName.trim(),
          username: formUsername.trim(),
          email: formEmail.trim().toLowerCase(),
          role: formRole,
          password: formPassword,
          password2: formPassword
        });
        setUsers((prev) => [created, ...prev]);
      }
      setModalOpen(false);
    } catch (e: any) {
      const msg = e?.data?.password2?.[0] || e?.data?.detail || 'An error occurred while committing registration parameters.';
      alert(msg);
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = (user: User) => {
    confirm(
      'Purge User Permanently',
      `Permanently delete structural record for "${user.full_name}"? Operational histories will be cleared. This action is irreversible.`,
      async () => {
        setMutatingId(user.id);
        try {
          await deleteUser(user.id);
          setUsers((prev) => prev.filter((u) => u.id !== user.id));
        } catch {
          alert('Purge aborted. Account possesses unresolved library hold binds, active loans, or fines.');
        } finally {
          setMutatingId(null);
        }
      }
    );
  };

  const cols = width > 1200 ? 3 : width > 768 ? 2 : 1;
  const GAP = 16;
  const PADDING = width > 768 ? 48 : 32;
  const cardW = (width - PADDING - GAP * (cols - 1)) / cols;

  if (loading) return <Loading />;

  return (
    <SidebarLayout currentScreen="Members">
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
            <Text style={s.headerTitle}>Librium Users Registry ({filtered.length})</Text>
            <TouchableOpacity style={s.addRegistryBtn} onPress={openCreateModal} activeOpacity={0.7}>
              <Feather name="user-plus" size={13} color="#F4EFE0" style={{ marginRight: 6 }} />
              <Text style={s.addRegistryTxt}>ADD ACCOUNT</Text>
            </TouchableOpacity>
          </View>

          <View style={s.toolbar}>
            <View style={s.searchWrap}>
              <Feather name="search" size={14} color="#A1927F" style={{ marginRight: 8 }} />
              <TextInput
                style={s.searchInput}
                placeholder="Query database by profile names, keys, credentials..."
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
              {(['all', 'admin', 'librarian', 'member'] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[s.filterTab, roleFilter === r && s.filterTabActive]}
                  onPress={() => setRoleFilter(r)}
                >
                  <Text style={[s.filterTxt, roleFilter === r && s.filterTxtActive]}>
                    {r === 'all' ? 'All Records' : r.charAt(0).toUpperCase() + r.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {filtered.length === 0 && <Empty text="No matching user records resolved in registry archives." />}

          <View style={s.gridContainer}>
            {filtered.map((u) => {
              const isExpanded = expandedId === u.id;
              const isMutating = mutatingId === u.id;
              const theme = ROLE_THEME[u.role] || ROLE_THEME.member;

              return (
                <Card key={u.id} style={{ ...s.customCard, width: cardW }}>
                  <View style={s.cardContent}>
                    <View style={s.identityBlock}>
                      <View style={s.identityHeader}>
                        <View style={[s.avatarCircle, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                          <Text style={[s.avatarText, { color: theme.text }]}>
                            {u.full_name ? u.full_name.charAt(0).toUpperCase() : '?'}
                          </Text>
                        </View>
                        <View style={s.statusPillStack}>
                          <View style={[s.rolePill, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                            <Text style={[s.roleText, { color: theme.text }]}>{u.role.toUpperCase()}</Text>
                          </View>
                        </View>
                      </View>
                      <Text style={s.userName} numberOfLines={1}>{u.full_name}</Text>
                      <View style={s.infoDetailLine}>
                        <Feather name="mail" size={11} color="#A1927F" />
                        <Text style={s.infoDetailText} numberOfLines={1}>{u.email}</Text>
                      </View>
                      <View style={s.infoDetailLine}>
                        <Feather name="at-sign" size={11} color="#A1927F" />
                        <Text style={s.infoDetailText} numberOfLines={1}>{u.username}</Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={s.drawerToggle}
                      activeOpacity={0.7}
                      onPress={() => setExpandedId(isExpanded ? null : u.id)}
                    >
                      <Text style={s.drawerToggleText}>
                        {isExpanded ? 'Collapse Details' : 'View Complete Record Profile'}
                      </Text>
                      <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={13} color="#513E2F" />
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={s.expandedDrawer}>
                        <View style={s.drawerMetricsGrid}>
                          <View style={s.metricRow}>
                            <Text style={s.metricLabel}>Date Added</Text>
                            <Text style={s.metricValue}>{new Date(u.date_joined).toLocaleDateString()}</Text>
                          </View>
                          <View style={s.metricRow}>
                            <Text style={s.metricLabel}>Sex</Text>
                            <Text style={s.metricValue}>{u.profile?.sex ? (SEX_LABEL[u.profile.sex] ?? u.profile.sex) : '—'}</Text>
                          </View>
                          <View style={s.metricRow}>
                            <Text style={s.metricLabel}>Contact Number</Text>
                            <Text style={s.metricValue}>{u.profile?.phone_number ?? '—'}</Text>
                          </View>
                          <View style={s.metricRow}>
                            <Text style={s.metricLabel}>Address</Text>
                            <Text style={s.metricValue} numberOfLines={2}>{u.profile?.address ?? '—'}</Text>
                          </View>
                        </View>

                        <View style={s.drawerActionsLayout}>
                          {isMutating ? (
                            <ActivityIndicator size="small" color="#281711" style={s.loaderPadding} />
                          ) : (
                            <>
                              <TouchableOpacity style={[s.utilityBtn, s.editBtn]} onPress={() => openEditModal(u)}>
                                <Feather name="edit-3" size={11} color="#513E2F" />
                                <Text style={s.editBtnText}>Modify Record</Text>
                              </TouchableOpacity>
                              <TouchableOpacity style={[s.utilityBtn, s.deleteBtn]} onPress={() => handleDelete(u)}>
                                <Feather name="trash-2" size={11} color="#C53030" />
                                <Text style={s.deleteBtnText}>Delete Account</Text>
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                      </View>
                    )}
                  </View>
                </Card>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <Modal animationType="fade" transparent visible={modalOpen} onRequestClose={() => setModalOpen(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{editingUser ? 'MODIFY USER PROFILE' : 'INITIALIZE SYSTEM ACCOUNT'}</Text>
            <View style={s.modalDivider} />
            <ScrollView contentContainerStyle={{ gap: 14 }}>
              <View>
                <Text style={s.fieldLabel}>Full Name:</Text>
                <TextInput style={s.modalInput} value={formName} onChangeText={setFormName} placeholder="E.g., Dr. Alexander Wright" placeholderTextColor="#A1927F" />
              </View>
              <View>
                <Text style={s.fieldLabel}>Username:</Text>
                <TextInput style={s.modalInput} value={formUsername} onChangeText={setFormUsername} autoCapitalize="none" placeholder="alex_wright" placeholderTextColor="#A1927F" />
              </View>
              <View>
                <Text style={s.fieldLabel}>Email Address:</Text>
                <TextInput style={s.modalInput} value={formEmail} onChangeText={setFormEmail} keyboardType="email-address" autoCapitalize="none" placeholder="wright@institution.edu" placeholderTextColor="#A1927F" />
              </View>
              {!editingUser && (
                <View>
                  <Text style={s.fieldLabel}>Password:</Text>
                  <TextInput style={s.modalInput} value={formPassword} onChangeText={setFormPassword} secureTextEntry autoCapitalize="none" placeholder="••••••••••••" placeholderTextColor="#A1927F" />
                </View>
              )}
              <View>
                <Text style={s.fieldLabel}>Authorization Role:</Text>
                <View style={s.roleSelectorRow}>
                  {(['member', 'librarian', 'admin'] as const).map((r) => (
                    <TouchableOpacity key={r} style={[s.roleSelectBox, formRole === r && s.roleSelectBoxActive]} onPress={() => setFormRole(r)}>
                      <Text style={[s.roleSelectTxt, formRole === r && s.roleSelectTxtActive]}>{r.toUpperCase()}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancelBtn} onPress={() => setModalOpen(false)}>
                <Text style={s.modalCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <Btn label={editingUser ? "COMMIT CHANGES" : "CREATE REGISTRY"} onPress={handleSaveUser} loading={modalLoading} style={s.modalSubmitBtn} textStyle={s.modalSubmitTxt} />
            </View>
          </View>
        </View>
      </Modal>
    </SidebarLayout>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ECE7D1' },
  inner: { paddingBottom: 60 },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderColor: '#DCD4C4',
    paddingBottom: 16,
  },
  headerTitle: { color: '#281711', fontSize: 15, fontWeight: '700', fontFamily: Fonts.baskervilleBold },
  addRegistryBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#281711', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 0 },
  addRegistryTxt: { fontFamily: Fonts.sans, color: '#F4EFE0', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  toolbar: { marginBottom: 20, gap: 10 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCD4C4', paddingHorizontal: 12, paddingVertical: 8 },
  searchInput: { flex: 1, fontSize: 13, color: '#281711', fontFamily: Fonts.sans, outlineWidth: 0 },
  filterRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  filterTab: { paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: '#DCD4C4', backgroundColor: '#FFFFFF' },
  filterTabActive: { backgroundColor: '#281711', borderColor: '#281711' },
  filterTxt: { fontSize: 11, fontWeight: '600', color: '#706251', fontFamily: Fonts.sans },
  filterTxtActive: { color: '#F4EFE0' },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, width: '100%' },
  customCard: { backgroundColor: '#FFFDF1', borderWidth: 1, borderColor: '#412D15', borderRadius: 0, minWidth: 280 },
  cardContent: { flex: 1, padding: 16 },
  identityBlock: { marginBottom: 12 },
  identityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  avatarCircle: { width: 46, height: 46, borderWidth: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 0 },
  avatarText: { fontSize: 18, fontWeight: '700', fontFamily: Fonts.baskervilleBold },
  statusPillStack: { alignItems: 'flex-end', gap: 4 },
  rolePill: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  roleText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.6, fontFamily: Fonts.sans },
  userName: { color: '#281711', fontFamily: Fonts.baskervilleBold, fontSize: 16, lineHeight: 22, marginBottom: 6 },
  infoDetailLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  infoDetailText: { color: '#4A3E3D', fontFamily: Fonts.sans, fontSize: 12, flex: 1 },
  drawerToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F4F1EA', paddingHorizontal: 10, paddingVertical: 8, marginTop: 8, borderWidth: 1, borderColor: '#DCD4C4' },
  drawerToggleText: { fontSize: 11, fontWeight: '600', color: '#513E2F', fontFamily: Fonts.sans },
  expandedDrawer: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: '#EFECE6' },
  drawerMetricsGrid: { gap: 6, marginBottom: 12 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  metricLabel: { color: '#A1927F', fontSize: 11, fontFamily: Fonts.sans },
  metricValue: { color: '#281711', fontSize: 11, fontWeight: '600', fontFamily: Fonts.sans, flex: 1, textAlign: 'right' },
  drawerActionsLayout: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end', borderTopWidth: 1, borderColor: '#F3F1EC', paddingTop: 10 },
  utilityBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1 },
  editBtn: { backgroundColor: '#FFFFFF', borderColor: '#DCD4C4' },
  editBtnText: { color: '#513E2F', fontSize: 10, fontWeight: '600' },
  deleteBtn: { backgroundColor: '#FCE8E6', borderColor: '#F5C2BC' },
  deleteBtnText: { color: '#C53030', fontSize: 10, fontWeight: '600' },
  loaderPadding: { paddingVertical: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(40, 23, 17, 0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { backgroundColor: '#F4EFE0', borderWidth: 1, borderColor: '#412D15', width: '100%', maxWidth: 460, padding: 24 },
  modalTitle: { fontFamily: Fonts.baskervilleBold, fontSize: 15, color: '#281711', letterSpacing: 1, textAlign: 'center' },
  modalDivider: { height: 1, backgroundColor: '#DCD4C4', marginVertical: 16 },
  fieldLabel: { fontFamily: Fonts.sans, fontSize: 12, color: '#513E2F', fontWeight: '600', marginBottom: 6 },
  modalInput: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCD4C4', paddingHorizontal: 12, height: 38, fontSize: 13, color: '#281711', fontFamily: Fonts.sans, outlineWidth: 0 },
  roleSelectorRow: { flexDirection: 'row', gap: 8 },
  roleSelectBox: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCD4C4', paddingVertical: 8, alignItems: 'center' },
  roleSelectBoxActive: { backgroundColor: '#281711', borderColor: '#281711' },
  roleSelectTxt: { fontFamily: Fonts.sans, fontSize: 10, fontWeight: '700', color: '#706251' },
  roleSelectTxtActive: { color: '#F4EFE0' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 24, borderTopWidth: 1, borderColor: '#DCD4C4', paddingTop: 16 },
  modalCancelBtn: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, height: 40, borderWidth: 1, borderColor: '#DCD4C4', backgroundColor: '#FFFFFF' },
  modalCancelTxt: { fontFamily: Fonts.sans, fontSize: 12, color: '#706251', fontWeight: '600' },
  modalSubmitBtn: { backgroundColor: '#281711', borderRadius: 0, height: 40, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  modalSubmitTxt: { fontFamily: Fonts.sans, fontSize: 12, color: '#F4EFE0', fontWeight: '700' },
});