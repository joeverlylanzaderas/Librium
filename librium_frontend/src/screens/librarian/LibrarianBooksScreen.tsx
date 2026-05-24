// ─────────────────────────────────────────────────────────────
//  LibrarianBooksScreen.tsx  — read-only browse + search
// ─────────────────────────────────────────────────────────────
import { getBooks } from '../../services/api';
import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, StyleSheet,
    RefreshControl, Alert, TextInput, Modal, ActivityIndicator,
  } from 'react-native';
import { C, Badge, Empty, Loading } from '../../components/UI';

type Book = {
  id:              number;
  title:           string;
  author_name:     string;
  category_name:   string | null;
  department_name: string | null;
  available:       boolean;
  isbn:            string;
  publication_year: number;
  description:     string | null;
};

export default function LibrarianBooksScreen() {
  const [books, setBooks]         = useState<Book[]>([]);
  const [search, setSearch]       = useState('');
  const [filterAvail, setFilterAvail] = useState<'all' | 'available' | 'borrowed'>('all');
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getBooks();
      setBooks(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = books.filter((b) => {
    const matchSearch = b.title.toLowerCase().includes(search.toLowerCase()) ||
                        b.author_name?.toLowerCase().includes(search.toLowerCase());
    const matchAvail =
      filterAvail === 'all'       ? true :
      filterAvail === 'available' ? b.available :
      !b.available;
    return matchSearch && matchAvail;
  });

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Search + filter */}
      <View style={sb.topBar}>
        <View style={sb.searchWrap}>
          <Text style={{ color: C.muted, marginRight: 6 }}>🔍</Text>
          <TextInput
            style={sb.searchInput}
            placeholder="Search books or authors..."
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
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
          {(['all', 'available', 'borrowed'] as const).map((f) => (
            <TouchableOpacity key={f} style={[sb.filterTab, filterAvail === f && sb.filterTabActive]} onPress={() => setFilterAvail(f)}>
              <Text style={[sb.filterTxt, filterAvail === f && sb.filterTxtActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
          <Text style={sb.count}>{filtered.length} books</Text>
        </View>
      </View>

      {loading ? <Loading /> : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={{ padding: 14, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.primary} />}
          ListEmptyComponent={<Empty text="No books found." />}
          renderItem={({ item }) => (
            <View style={sb.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={sb.title} numberOfLines={2}>{item.title}</Text>
                  <Text style={sb.author}>{item.author_name}</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    {item.category_name && <Badge label={item.category_name} color={C.primary} />}
                    {item.department_name && <Badge label={item.department_name} color="#a78bfa" />}
                  </View>
                  <Text style={sb.meta}>ISBN: {item.isbn}  ·  {item.publication_year}</Text>
                </View>
                <Badge
                  label={item.available ? 'Available' : 'On Loan'}
                  color={item.available ? C.success : C.danger}
                />
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const sb = StyleSheet.create({
  topBar:         { backgroundColor: C.surface, padding: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  searchWrap:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 8 },
  searchInput:    { flex: 1, color: C.text, fontSize: 14 },
  filterTab:      { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: C.border },
  filterTabActive:{ backgroundColor: C.primary, borderColor: C.primary },
  filterTxt:      { color: C.sub, fontSize: 12, fontWeight: '600' },
  filterTxtActive:{ color: '#fff' },
  count:          { color: C.muted, fontSize: 12, alignSelf: 'center', marginLeft: 'auto' },
  card:           { backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  title:          { color: C.text, fontSize: 14, fontWeight: '700' },
  author:         { color: C.sub, fontSize: 12, marginTop: 2 },
  meta:           { color: C.muted, fontSize: 11, marginTop: 6 },
});