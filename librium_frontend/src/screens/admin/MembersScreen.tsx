// admin/MembersScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, ActivityIndicator, useWindowDimensions, TextInput
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getUsers, updateUser, deleteUser } from '../../services/api';
import { Card, Empty, Loading } from '../../components/UI';
import SidebarLayout from '../../components/SidebarLayout';
import { Fonts } from '../../constants/theme';

type User = {
  id:          number;
  email:       string;
  username:    string;
  full_name:   string;
  role:        'admin' | 'librarian' | 'member';
  is_active:   boolean;
  date_joined: string;
  profile?: {
    phone_number?: string;
    address?:      string;
    birthday?:     string;
    sex?:          string | null;
  };
};

// Web-safe confirmation action module
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

// --- Dedicated Palette Accents Matching Book Screen Architecture ---
const ROLE_THEME: Record<string, { bg: string; text: string; border: string }> = {
  admin:     { bg: '#FEF3C7', text: '#D97706', border: '#FCD34D' }, // Warm Amber Academia
  librarian: { bg: '#EDE9FE', text: '#7C3AED', border: '#DDD6FE' }, // Royal Lilac Archive
  member:    { bg: '#E0F2FE', text: '#0369A1', border: '#BAE6FD' }, // Soft Ink Blue
};

const SEX_LABEL: Record<string, string> = { M: 'Male', F: 'Female', O: 'Other' };

export default function MembersScreen() {
  const { width } = useWindowDimensions();

  const [users, setUsers]           = useState<User[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'librarian' | 'member'>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getUsers();
      setUsers(data.results ?? data);
    } catch (e) {
      console.warn('Members load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // --- Filter and Search Matrix Processing ---
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

  // --- Member State Lifecycles ---
  const handleDeactivate = (user: User) => {
    confirm(
      'Deactivate Member',
      `Deactivate "${user.full_name}"? They won't be able to access system features until restored.`,
      async () => {
        setTogglingId(user.id);
        try {
          await updateUser(user.id, { is_active: false });
          setUsers((prev) =>
            prev.map((u) => (u.id === user.id ? { ...u, is_active: false } : u))
          );
        } catch {
          alert('Could not deactivate user account.');
        } finally {
          setTogglingId(null);
        }
      }
    );
  };

  const handleReactivate = (user: User) => {
    confirm(
      'Reactivate Member',
      `Restore active privileges to "${user.full_name}"?`,
      async () => {
        setTogglingId(user.id);
        try {
          await updateUser(user.id, { is_active: true });
          setUsers((prev) =>
            prev.map((u) => (u.id === user.id ? { ...u, is_active: true } : u))
          );
        } catch {
          alert('Could not reactivate user account.');
        } finally {
          setTogglingId(null);
        }
      }
    );
  };

  const handleDelete = (user: User) => {
    confirm(
      'Delete User Permanently',
      `Permanently purge "${user.full_name}"? This action completely destroys operational histories and cannot be undone.`,
      async () => {
        setTogglingId(user.id);
        try {
          await deleteUser(user.id);
          setUsers((prev) => prev.filter((u) => u.id !== user.id));
        } catch {
          alert('Purge operation aborted. User possesses active library holds, outstanding loans, or fine dependencies.');
        } finally {
          setTogglingId(null);
        }
      }
    );
  };

  // --- Multi-Column Layout Grid Dimensions ---
  const cols    = width > 1200 ? 3 : width > 768 ? 2 : 1;
  const GAP     = 16;
  const PADDING = width > 768 ? 48 : 32;
  const cardW   = (width - PADDING - GAP * (cols - 1)) / cols;

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
          {/* --- Header --- */}
          <View style={s.headerContainer}>
            <Text style={s.headerTitle}>Registry Directory ({filtered.length})</Text>
          </View>

          {/* --- Search + Filter Toolbar Module --- */}
          <View style={s.toolbar}>
            <View style={s.searchWrap}>
              <Feather name="search" size={14} color="#A1927F" style={{ marginRight: 8 }} />
              <TextInput
                style={s.searchInput}
                placeholder="Query registry by name, email, identifier..."
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
                    {r === 'all' ? 'All Accounts' : r.charAt(0).toUpperCase() + r.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {filtered.length === 0 && <Empty text="No matching user accounts identified within directory." />}

          {/* --- Responsive Registry Layout Workspace --- */}
          <View style={s.gridContainer}>
            {filtered.map((u) => {
              const isExpanded = expandedId === u.id;
              const isToggling = togglingId === u.id;
              const theme = ROLE_THEME[u.role] || ROLE_THEME.member;

              return (
                <Card 
                  key={u.id} 
                  style={{ 
                    ...s.customCard, 
                    width: cardW,
                    opacity: u.is_active ? 1 : 0.65 
                  }}
                >
                  <View style={s.cardContent}>
                    
                    {/* User Identity Segment */}
                    <View style={s.identityBlock}>
                      <View style={s.identityHeader}>
                        {/* Monogram Monolithic Profile Frame */}
                        <View style={[s.avatarCircle, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                          <Text style={[s.avatarText, { color: theme.text }]}>
                            {u.full_name ? u.full_name.charAt(0).toUpperCase() : '?'}
                          </Text>
                        </View>

                        <View style={s.statusPillStack}>
                          <View style={[s.rolePill, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                            <Text style={[s.roleText, { color: theme.text }]}>{u.role.toUpperCase()}</Text>
                          </View>
                          {!u.is_active && (
                            <View style={s.inactivePill}>
                              <Text style={s.inactiveText}>SUSPENDED</Text>
                            </View>
                          )}
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

                    {/* Expandable Meta Panel Drawer Toggle */}
                    <TouchableOpacity
                      style={s.drawerToggle}
                      activeOpacity={0.7}
                      onPress={() => setExpandedId(isExpanded ? null : u.id)}
                    >
                      <Text style={s.drawerToggleText}>
                        {isExpanded ? 'Hide Structural Profile' : 'View Complete Profile'}
                      </Text>
                      <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={13} color="#513E2F" />
                    </TouchableOpacity>

                    {/* Profile Information Sub-Drawer */}
                    {isExpanded && (
                      <View style={s.expandedDrawer}>
                        <View style={s.drawerMetricsGrid}>
                          <View style={s.metricRow}>
                            <Text style={s.metricLabel}>Enrollment Date</Text>
                            <Text style={s.metricValue}>{new Date(u.date_joined).toLocaleDateString()}</Text>
                          </View>
                          <View style={s.metricRow}>
                            <Text style={s.metricLabel}>Gender Reference</Text>
                            <Text style={s.metricValue}>{u.profile?.sex ? (SEX_LABEL[u.profile.sex] ?? u.profile.sex) : '—'}</Text>
                          </View>
                          <View style={s.metricRow}>
                            <Text style={s.metricLabel}>Contact Line</Text>
                            <Text style={s.metricValue}>{u.profile?.phone_number ?? '—'}</Text>
                          </View>
                          <View style={s.metricRow}>
                            <Text style={s.metricLabel}>Mailing Address</Text>
                            <Text style={s.metricValue} numberOfLines={2}>{u.profile?.address ?? '—'}</Text>
                          </View>
                        </View>

                        {/* Administrative Modification Triggers */}
                        <View style={s.drawerActionsLayout}>
                          {isToggling ? (
                            <ActivityIndicator size="small" color="#281711" style={s.loaderPadding} />
                          ) : (
                            <>
                              {u.is_active ? (
                                <TouchableOpacity 
                                  style={[s.utilityBtn, s.deactivateBtn]} 
                                  onPress={() => handleDeactivate(u)}
                                >
                                  <Feather name="slash" size={11} color="#8A2B2B" />
                                  <Text style={s.deactivateBtnText}>Suspend</Text>
                                </TouchableOpacity>
                              ) : (
                                <TouchableOpacity 
                                  style={[s.utilityBtn, s.reactivateBtn]} 
                                  onPress={() => handleReactivate(u)}
                                >
                                  <Feather name="check" size={11} color="#137333" />
                                  <Text style={s.reactivateBtnText}>Reactivate</Text>
                                </TouchableOpacity>
                              )}

                              <TouchableOpacity 
                                style={[s.utilityBtn, s.deleteBtn]} 
                                onPress={() => handleDelete(u)}
                              >
                                <Feather name="trash-2" size={11} color="#C53030" />
                                <Text style={s.deleteBtnText}>Purge Account</Text>
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
    </SidebarLayout>
  );
}

// --- Absolute Visual Theme Alignment Stylesheet ---
const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: '#ECE7D1' },
  inner: { paddingBottom: 60 },

  // Document Heading Layout
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderColor: '#E8E4D9',
    paddingBottom: 16,
  },
  headerTitle: {
    color: '#281711',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: Fonts.baskervilleBold,
  },

  // Operations Control Hub 
  toolbar: {
    marginBottom: 20,
    gap: 10,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCD4C4',
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#281711',
    fontFamily: Fonts.sans,
    outlineWidth: 0, // Eliminates browser focus ring on Web exports
  },
  filterRow: { 
    flexDirection: 'row', 
    gap: 8, 
    flexWrap: 'wrap' 
  },
  filterTab: { 
    paddingHorizontal: 14, 
    paddingVertical: 6, 
    borderWidth: 1, 
    borderColor: '#DCD4C4', 
    backgroundColor: '#FFFFFF' 
  },
  filterTabActive: { 
    backgroundColor: '#281711', 
    borderColor: '#281711' 
  },
  filterTxt: { 
    fontSize: 11, 
    fontWeight: '600', 
    color: '#706251', 
    fontFamily: Fonts.sans 
  },
  filterTxtActive: { 
    color: '#F4EFE0' 
  },

  // Multi-Column Flow Architecture
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    width: '100%',
  },
  customCard: {
    backgroundColor: '#FFFDF1',
    borderWidth: 1,
    borderColor: '#412D15',
    borderRadius: 0,
    minWidth: 280,
  },
  cardContent: {
    flex: 1,
    padding: 16,
  },

  // Profile Context Cards
  identityBlock: {
    marginBottom: 12,
  },
  identityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 0, // Structural flat signature block format
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: Fonts.baskervilleBold,
  },
  statusPillStack: {
    alignItems: 'flex-end',
    gap: 4,
  },
  rolePill: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  roleText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    fontFamily: Fonts.sans,
  },
  inactivePill: {
    backgroundColor: '#FCE8E6',
    borderColor: '#F5C2BC',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  inactiveText: {
    color: '#8A2B2B',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  userName: {
    color: '#281711',
    fontFamily: Fonts.baskervilleBold,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 6,
  },
  infoDetailLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  infoDetailText: {
    color: '#4A3E3D',
    fontFamily: Fonts.sans,
    fontSize: 12,
    flex: 1,
  },

  // Expandable Compartments
  drawerToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F4F1EA',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#DCD4C4',
  },
  drawerToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#513E2F',
    fontFamily: Fonts.sans,
  },
  expandedDrawer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#EFECE6',
  },
  drawerMetricsGrid: {
    gap: 6,
    marginBottom: 12,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  metricLabel: {
    color: '#A1927F',
    fontSize: 11,
    fontFamily: Fonts.sans,
  },
  metricValue: {
    color: '#281711',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: Fonts.sans,
    flex: 1,
    textAlign: 'right',
  },

  // System Utility Modifiers
  drawerActionsLayout: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderColor: '#F3F1EC',
    paddingTop: 10,
  },
  utilityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  deactivateBtn: {
    backgroundColor: '#FFF5F5',
    borderColor: '#FEB2B2',
  },
  deactivateBtnText: {
    color: '#8A2B2B',
    fontSize: 10,
    fontWeight: '600',
  },
  reactivateBtn: {
    backgroundColor: '#E6F4EA',
    borderColor: '#B7DFC4',
  },
  reactivateBtnText: {
    color: '#137333',
    fontSize: 10,
    fontWeight: '600',
  },
  deleteBtn: {
    backgroundColor: '#FCE8E6',
    borderColor: '#F5C2BC',
  },
  deleteBtnText: {
    color: '#C53030',
    fontSize: 10,
    fontWeight: '600',
  },
  loaderPadding: {
    paddingVertical: 4,
  },
});