// ─────────────────────────────────────────────────────────────
//  LibrarianMembersScreen.tsx  — view member list + details
// ─────────────────────────────────────────────────────────────
import { getUsers } from '../../services/api';
import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, StyleSheet,
    RefreshControl, Alert, TextInput, Modal, ActivityIndicator,
  } from 'react-native';
import { C, Badge, Empty, Loading } from '../../components/UI';

type Member = {
  id:          number;
  email:       string;
  username:    string;
  full_name:   string;
  role:        string;
  is_active:   boolean;
  date_joined: string;
  profile: {
    phone_number: string;
    birthday:     string | null;
    sex:          string | null;
    age:          number | null;
  } | null;
};

export default function LibrarianMembersScreen() {
  const [members, setMembers]     = useState<Member[]>([]);
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded]   = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getUsers();
      setMembers(data.filter((u: Member) => u.role === 'member'));
    } catch (e) { }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = members.filter((m) =>
    m.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    m.email?.toLowerCase().includes(search.toLowerCase()) ||
    m.username?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Search */}
      <View style={sm.topBar}>
        <View style={sm.searchWrap}>
          <Text style={{ color: C.muted, marginRight: 6 }}>🔍</Text>
          <TextInput
            style={sm.searchInput}
            placeholder="Search by name, email, or username..."
            placeholderTextColor={C.muted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={{ color: C.muted, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={sm.count}>{filtered.length} members</Text>
      </View>

      {loading ? <Loading /> : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={{ padding: 14, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.primary} />}
          ListEmptyComponent={<Empty text="No members found." />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={sm.card}
              onPress={() => setExpanded(expanded === item.id ? null : item.id)}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={sm.name}>{item.full_name}</Text>
                  <Text style={sm.email}>{item.email}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Badge
                    label={item.is_active ? 'Active' : 'Inactive'}
                    color={item.is_active ? C.success : C.muted}
                  />
                  <Text style={sm.chevron}>{expanded === item.id ? '▲' : '▼'}</Text>
                </View>
              </View>

              {expanded === item.id && (
                <View style={sm.details}>
                  <View style={sm.detailRow}>
                    <Text style={sm.detailLabel}>Username</Text>
                    <Text style={sm.detailValue}>{item.username}</Text>
                  </View>
                  <View style={sm.detailRow}>
                    <Text style={sm.detailLabel}>Joined</Text>
                    <Text style={sm.detailValue}>{item.date_joined?.split('T')[0]}</Text>
                  </View>
                  {item.profile?.phone_number ? (
                    <View style={sm.detailRow}>
                      <Text style={sm.detailLabel}>Phone</Text>
                      <Text style={sm.detailValue}>{item.profile.phone_number}</Text>
                    </View>
                  ) : null}
                  {item.profile?.age ? (
                    <View style={sm.detailRow}>
                      <Text style={sm.detailLabel}>Age</Text>
                      <Text style={sm.detailValue}>{item.profile.age}</Text>
                    </View>
                  ) : null}
                  {item.profile?.sex ? (
                    <View style={sm.detailRow}>
                      <Text style={sm.detailLabel}>Sex</Text>
                      <Text style={sm.detailValue}>{item.profile.sex === 'M' ? 'Male' : item.profile.sex === 'F' ? 'Female' : 'Other'}</Text>
                    </View>
                  ) : null}
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const sm = StyleSheet.create({
  topBar:      { backgroundColor: C.surface, padding: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  searchWrap:  { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 8 },
  searchInput: { flex: 1, color: C.text, fontSize: 14 },
  count:       { color: C.muted, fontSize: 12, marginTop: 6 },
  card:        { backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  name:        { color: C.text, fontSize: 14, fontWeight: '700' },
  email:       { color: C.sub, fontSize: 12, marginTop: 2 },
  chevron:     { color: C.muted, fontSize: 10 },
  details:     { marginTop: 12, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10, gap: 4 },
  detailRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  detailLabel: { color: C.muted, fontSize: 12 },
  detailValue: { color: C.text, fontSize: 12, fontWeight: '600' },
});
