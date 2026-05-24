import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, RefreshControl, Alert, ActivityIndicator, Modal, ScrollView, Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  getBooks, getCategories, createBorrowRequest, createReservation,
  getLoans, getReservations, getBorrowRequests, getFines,
} from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { C, Badge, Empty, Loading } from '../../components/UI';
import SidebarLayout from '../../components/SidebarLayout';

type Book = {
  id: number;
  title: string;
  author_name: string;
  category_name: string | null;
  department_name: string | null;
  available: boolean;
  isbn: string;
  publication_year: number;
  description: string | null;
  cover_image: string | null; 
};

type Category = { id: number; name: string };

type MemberStats = {
  active_loans: number;
  overdue: number;
  reservations: number;
  pending_requests: number;
  unpaid_fines: number;
};

const STAT_CARDS = [
  { key: 'active_loans', label: 'Active Loans', icon: '📚', color: '#B8860B', targetScreen: 'BorrowerLoans' },
  { key: 'overdue', label: 'Overdue', icon: '⚠️', color: '#8B4513', targetScreen: 'BorrowerLoans' },
  { key: 'reservations', label: 'Reservations', icon: '🔖', color: '#DAA520', targetScreen: 'BorrowerReservations' },
  { key: 'pending_requests', label: 'Pending', icon: '⏳', color: '#CD853F', targetScreen: 'BorrowerRequests' },
  { key: 'unpaid_fines', label: 'Unpaid Fines', icon: '💸', color: '#A0522D', targetScreen: 'BorrowerFines' },
] as const;

export default function BorrowerHomeScreen() {
  const { user, signOut } = useAuth();
  const navigation = useNavigation<any>();
  const [activeLoanedBookIds, setActiveLoanedBookIds] = useState<number[]>([]);
  const [activeReservedBookIds, setActiveReservedBookIds] = useState<number[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<MemberStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [filterAvail, setFilterAvail] = useState<'all' | 'available'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState<number | null>(null);
  const [selected, setSelected] = useState<Book | null>(null);

  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const [loans, reservations, requests, fines] = await Promise.all([
        getLoans(),
        getReservations(),
        getBorrowRequests(),
        getFines(),
      ]);

      // Track active loans (books user currently has)
      const ongoingLoans = loans.filter((l: any) => ['none', 'pending', null].includes(l.return_status));
      const loanedIds = ongoingLoans.map((l: any) => {
        if (l.book && typeof l.book === 'object') return Number(l.book.id);
        return Number(l.book);
      }).filter(Boolean);
      setActiveLoanedBookIds(loanedIds);

      // Track active reservations (books user has reserved but not yet borrowed)
      const activeReservations = reservations.filter((r: any) => ['waiting', 'ready'].includes(r.status));
      const reservedIds = activeReservations.map((r: any) => {
        if (r.book && typeof r.book === 'object') return Number(r.book.id);
        return Number(r.book);
      }).filter(Boolean);
      setActiveReservedBookIds(reservedIds);

      setStats({
        active_loans: ongoingLoans.length,
        overdue: loans.filter((l: any) => l.is_overdue).length,
        reservations: activeReservations.length,
        pending_requests: requests.filter((r: any) => r.status === 'pending').length,
        unpaid_fines: fines.filter((f: any) => !f.paid).reduce((sum: number, f: any) => sum + parseFloat(f.amount || '0'), 0),
      });
    } catch (e) {
      console.error('Stats error', e);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadBooks = useCallback(async () => {
    try {
      const [booksData, catData] = await Promise.all([getBooks(), getCategories()]);
      const normalizedBooks = booksData.map((b: any) => ({
        ...b,
        cover_image: b.cover_image || b.cover_image_url || null
      }));
      setBooks(normalizedBooks);
      setCategories(catData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const load = useCallback(async () => {
    await Promise.all([loadStats(), loadBooks()]);
  }, [loadStats, loadBooks]);

  useEffect(() => { load(); }, [load]);

  const filtered = books.filter((b) => {
    const matchSearch = b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.author_name?.toLowerCase().includes(search.toLowerCase());
    const targetCategoryName = categories.find(c => c.id === categoryId)?.name;
    const matchCat = categoryId 
      ? b.category_name?.toLowerCase() === targetCategoryName?.toLowerCase() 
      : true;
    const matchAvail = filterAvail === 'available' ? b.available : true;
    return matchSearch && matchCat && matchAvail;
  });

  const handleBorrowRequest = async (book: Book) => {
    console.log('🔵 Button clicked for book:', book.id, book.title);
    console.log('🔵 Book available:', book.available);
    console.log('🔵 Active loaned IDs:', activeLoanedBookIds);
    console.log('🔵 Active reserved IDs:', activeReservedBookIds);
    
    // Check if user already has this book on loan
    if (activeLoanedBookIds.map(Number).includes(Number(book.id))) {
      Alert.alert(
        'Action Prohibited',
        `You cannot borrow or reserve "${book.title}" because you currently have it checked out.`
      );
      return;
    }

    // Check if user already has a reservation for this book
    if (activeReservedBookIds.map(Number).includes(Number(book.id))) {
      Alert.alert(
        'Already Reserved',
        `You already have a reservation for "${book.title}". You will be notified when it becomes available.`
      );
      return;
    }

    // If book is unavailable (on loan by someone else)
    if (!book.available) {
      console.log('🟡 Book unavailable, showing reserve dialog');
      
      const confirmReserve = window.confirm 
        ? window.confirm(`"${book.title}" is currently on loan. Would you like to join the waitlist?`)
        : true;
      
      if (confirmReserve) {
        setActing(book.id);
        try {
          console.log('📤 Sending reservation for book:', book.id);
          const response = await createReservation({ book: book.id });
          console.log('✅ Reservation response:', response);
          
          Alert.alert('Reserved', 'You have been added to the waitlist.');
          await load();
        } catch (e: any) {
          console.error('❌ Reservation error:', e?.status, e?.data);
          const errorMsg = e?.data?.detail || 
            e?.data?.error || 
            e?.data?.book?.[0] ||
            'Could not create reservation.';
          Alert.alert('Error', errorMsg);
        } finally { 
          setActing(null); 
        }
      }
      return;
    }

    // Book is available - execute borrow directly
    console.log('🟢 Book available, sending borrow request directly');
    setActing(book.id);
    try {
      console.log('📤 Sending borrow request for book:', book.id);
      const response = await createBorrowRequest({ book: book.id });
      console.log('✅ Borrow request response:', response);
      Alert.alert('Request Submitted', 'A librarian will process it shortly.');
      await load();
    } catch (e: any) {
      console.error('❌ Borrow request error:', e?.status, e?.data);
      const errorMsg = e?.data?.detail || 
        e?.data?.error || 
        e?.data?.book?.[0] ||
        'Could not submit request.';
      Alert.alert('Error', errorMsg);
    } finally { 
      setActing(null); 
    }
  };

  const StatsStrip = () => (
    <View style={s.statsContainer}>
      <View style={s.statsHeaderRow}>
        <View style={s.statsHeader}>
          <Text style={s.statsGreeting}>Dear {user?.full_name?.split(' ')[0] ?? 'Reader'} 👋</Text>
          <Text style={s.statsSubtitle}>Welcome to your literary journey</Text>
        </View>
        <TouchableOpacity style={s.logoutBtn} onPress={signOut}>
          <Text style={s.logoutTxt}>Exit Library</Text>
        </TouchableOpacity>
      </View>

      {statsLoading ? (
        <View style={s.statsLoadingRow}>
          <ActivityIndicator color="#B8860B" size="small" />
          <Text style={{ color: '#8B7355', marginLeft: 8, fontSize: 12 }}>Loading your library record…</Text>
        </View>
      ) : stats ? (
        <>
          {stats.overdue > 0 && (
            <TouchableOpacity style={s.overdueBanner} onPress={() => navigation.navigate('BorrowerLoans')}>
              <Text style={s.overdueBannerText}>📜 You have {stats.overdue} overdue {stats.overdue === 1 ? 'volume' : 'volumes'} — tap to review</Text>
            </TouchableOpacity>
          )}

          {stats.unpaid_fines > 0 && (
            <TouchableOpacity style={s.finesBanner} onPress={() => navigation.navigate('BorrowerFines')}>
              <Text style={s.finesBannerText}>🏛️ Unpaid fines: ₱{stats.unpaid_fines.toFixed(2)} — tap to settle</Text>
            </TouchableOpacity>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.statsRow}>
            {STAT_CARDS.map(({ key, label, icon, color, targetScreen }) => {
              const value = stats[key];
              const display = key === 'unpaid_fines' ? `₱${(value as number).toFixed(2)}` : String(value);
              return (
                <TouchableOpacity key={key} style={[s.statCard, { borderTopColor: color }]} onPress={() => navigation.navigate(targetScreen)} activeOpacity={0.7}>
                  <Text style={s.statIcon}>{icon}</Text>
                  <Text style={[s.statValue, { color }]}>{display}</Text>
                  <Text style={s.statLabel}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      ) : null}
    </View>
  );

  const ListHeader = () => (
    <>
      <StatsStrip />
      <View style={s.topBar}>
        <View style={s.searchWrap}>
          <Text style={{ color: '#8B7355', marginRight: 6 }}>🔍</Text>
          <TextInput
            style={s.searchInput}
            placeholder="Search by title or author..."
            placeholderTextColor="#A68A64"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={{ color: '#8B7355', fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={s.filterRow}>
          {(['all', 'available'] as const).map((f) => (
            <TouchableOpacity key={f} style={[s.filterTab, filterAvail === f && s.filterTabActive]} onPress={() => setFilterAvail(f)}>
              <Text style={[s.filterTxt, filterAvail === f && s.filterTxtActive]}>{f === 'all' ? 'All Holdings' : 'Available Now'}</Text>
            </TouchableOpacity>
          ))}
          <Text style={s.count}>{filtered.length} volumes</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
          <TouchableOpacity style={[s.chip, !categoryId && s.chipActive]} onPress={() => setCategoryId(null)}>
            <Text style={[s.chipTxt, !categoryId && s.chipTxtActive]}>All Sections</Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[s.chip, categoryId === cat.id && s.chipActive]}
              onPress={() => setCategoryId(categoryId === cat.id ? null : cat.id)}
            >
              <Text style={[s.chipTxt, categoryId === cat.id && s.chipTxtActive]}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </>
  );

  const renderBookItem = ({ item }: { item: Book }) => {
    const isReserved = activeReservedBookIds.includes(item.id);
    const isLoaned = activeLoanedBookIds.includes(item.id);
    const isDisabled = isReserved || isLoaned;
    
    let buttonText = 'Borrow';
    if (isReserved) buttonText = 'Reserved';
    else if (!item.available) buttonText = 'Reserve';
    else buttonText = 'Borrow';
    
    return (
      <TouchableOpacity style={s.card} onPress={() => setSelected(item)} activeOpacity={0.85}>
        <View style={s.cardRow}>
          <View style={s.coverContainer}>
            {item.cover_image ? ( 
              <Image
                source={{ uri: item.cover_image }}
                style={s.coverImage}
                resizeMode="cover"
              />
            ) : (
              <View style={s.coverPlaceholder}>
                <Text style={s.coverPlaceholderText}>📖</Text>
                <Text style={s.coverPlaceholderLabel}>No Cover</Text>
              </View>
            )}
          </View>

          <View style={s.detailsContainer}>
            <Text style={s.title} numberOfLines={2}>{item.title}</Text>
            <Text style={s.author}>by {item.author_name}</Text>
            <View style={s.badgeRow}>
              {item.category_name && <Badge label={item.category_name} color="#B8860B" />}
              {item.department_name && <Badge label={item.department_name} color="#DAA520" />}
            </View>
            <Text style={s.meta}>ISBN: {item.isbn} · {item.publication_year}</Text>
          </View>

          <View style={s.actionContainer}>
            <Badge
              label={item.available ? 'On Shelf' : 'Checked Out'}
              color={item.available ? '#2E7D32' : '#8B4513'}
            />
            <TouchableOpacity
              style={[
                s.actionBtn, 
                { 
                  backgroundColor: item.available ? '#8B6914' : '#A0522D',
                  opacity: isDisabled ? 0.5 : 1
                }
              ]}
              onPress={() => handleBorrowRequest(item)}
              disabled={acting === item.id || isDisabled}
            >
              {acting === item.id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.actionTxt}>{buttonText}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SidebarLayout>
      <View style={{ flex: 1, backgroundColor: '#F5F0E8' }}>
        {loading ? (
          <View style={{ flex: 1 }}>
            <StatsStrip />
            <Loading />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(i) => String(i.id)}
            contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 32 }}
            ListHeaderComponent={<ListHeader />}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#B8860B" />}
            ListEmptyComponent={<View style={{ paddingTop: 16 }}><Empty text="No books found in the archives." /></View>}
            renderItem={renderBookItem}
          />
        )}

        {/* Details Modal */}
        <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
          <View style={s.modalOverlay}>
            <ScrollView style={s.modalSheet} contentContainerStyle={{ paddingBottom: 30 }}>
              <View style={s.modalHeader}>
                <TouchableOpacity onPress={() => setSelected(null)} style={s.modalCloseBtn}>
                  <Text style={s.modalCloseTxt}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={s.modalCoverContainer}>
                {selected?.cover_image ? ( 
                  <Image
                    source={{ uri: selected.cover_image }}
                    style={s.modalCoverImage}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={s.modalCoverPlaceholder}>
                    <Text style={s.modalCoverPlaceholderText}>📖</Text>
                  </View>
                )}
              </View>

              <Text style={s.modalTitle}>{selected?.title}</Text>
              <Text style={s.modalAuthor}>by {selected?.author_name}</Text>

              <View style={s.modalBadgeRow}>
                {selected?.category_name && <Badge label={selected.category_name} color="#B8860B" />}
                {selected?.department_name && <Badge label={selected.department_name} color="#DAA520" />}
                <Badge
                  label={selected?.available ? 'On Shelf' : 'Checked Out'}
                  color={selected?.available ? '#2E7D32' : '#8B4513'}
                />
              </View>

              <View style={s.modalInfoRow}>
                <Text style={s.modalInfoLabel}>ISBN:</Text>
                <Text style={s.modalInfoValue}>{selected?.isbn}</Text>
              </View>
              <View style={s.modalInfoRow}>
                <Text style={s.modalInfoLabel}>Year:</Text>
                <Text style={s.modalInfoValue}>{selected?.publication_year}</Text>
              </View>

              {selected?.description && (
                <>
                  <Text style={s.modalDescTitle}>Synopsis</Text>
                  <Text style={s.modalDesc}>{selected.description}</Text>
                </>
              )}

              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: selected?.available ? '#8B6914' : '#A0522D' }]}
                onPress={() => {
                  if (selected) {
                    const bookToProcess = selected;
                    setSelected(null);
                    handleBorrowRequest(bookToProcess);
                  }
                }}
                disabled={acting === selected?.id || activeReservedBookIds.includes(selected?.id) || activeLoanedBookIds.includes(selected?.id)}
              >
                {acting === selected?.id ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.modalBtnTxt}>
                    {activeReservedBookIds.includes(selected?.id) 
                      ? 'Already Reserved' 
                      : (selected?.available ? '📖 Request to Borrow' : '📝 Join Waitlist')}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>
      </View>
    </SidebarLayout>
  );
}

const s = StyleSheet.create({
  statsContainer: { backgroundColor: '#F8F4EC', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E8DCC8' },
  statsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  statsHeader: { flex: 1 },
  statsGreeting: { color: '#4A3728', fontSize: 18, fontWeight: '700', fontFamily: 'Georgia' },
  statsSubtitle: { color: '#8B7355', fontSize: 12, marginTop: 2, fontStyle: 'italic' },
  logoutBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 0, borderWidth: 1, borderColor: '#C4A77D', backgroundColor: '#FFF8F0' },
  logoutTxt: { color: '#8B4513', fontSize: 12, fontWeight: '600' },
  statsLoadingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  statsRow: { paddingHorizontal: 12, paddingBottom: 4, gap: 8 },
  statCard: { backgroundColor: '#FFFDF9', borderRadius: 0, borderWidth: 1, borderColor: '#E8DCC8', borderTopWidth: 3, padding: 12, minWidth: 90, alignItems: 'center' },
  statIcon: { fontSize: 18, marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: '800', fontFamily: 'Georgia' },
  statLabel: { color: '#8B7355', fontSize: 10, fontWeight: '600', marginTop: 2, textAlign: 'center' },
  overdueBanner: { marginHorizontal: 12, marginBottom: 8, backgroundColor: '#8B451322', borderRadius: 0, borderWidth: 1, borderColor: '#8B4513', paddingHorizontal: 12, paddingVertical: 8 },
  overdueBannerText: { color: '#8B4513', fontSize: 12, fontWeight: '600' },
  finesBanner: { marginHorizontal: 12, marginBottom: 8, backgroundColor: '#A0522D22', borderRadius: 0, borderWidth: 1, borderColor: '#A0522D', paddingHorizontal: 12, paddingVertical: 8 },
  finesBannerText: { color: '#A0522D', fontSize: 12, fontWeight: '600' },

  topBar: { backgroundColor: '#F8F4EC', padding: 12, borderBottomWidth: 1, borderBottomColor: '#E8DCC8' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFDF9', borderRadius: 0, borderWidth: 1, borderColor: '#C4A77D', paddingHorizontal: 12, paddingVertical: 8 },
  searchInput: { flex: 1, color: '#4A3728', fontSize: 14, fontFamily: 'Georgia' },
  filterRow: { flexDirection: 'row', gap: 6, marginTop: 8, alignItems: 'center' },
  filterTab: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 0, borderWidth: 1, borderColor: '#C4A77D' },
  filterTabActive: { backgroundColor: '#8B6914', borderColor: '#8B6914' },
  filterTxt: { color: '#8B7355', fontSize: 12, fontWeight: '600' },
  filterTxtActive: { color: '#FFF' },
  count: { color: '#8B7355', fontSize: 12, marginLeft: 'auto', fontStyle: 'italic' },
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 0, borderWidth: 1, borderColor: '#C4A77D', marginRight: 6, backgroundColor: '#FFFDF9' },
  chipActive: { backgroundColor: '#8B691422', borderColor: '#8B6914' },
  chipTxt: { color: '#8B7355', fontSize: 12 },
  chipTxtActive: { color: '#8B6914', fontWeight: '600' },

  card: { backgroundColor: '#FFFDF9', borderRadius: 0, borderWidth: 1, borderColor: '#E8DCC8', padding: 14, marginBottom: 10, marginTop: 10, shadowColor: '#4A3728', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardRow: { flexDirection: 'row', gap: 12 },
  coverContainer: { width: 70, height: 100, backgroundColor: '#F8F4EC', borderWidth: 1, borderColor: '#E8DCC8', justifyContent: 'center', alignItems: 'center' },
  coverImage: { width: 68, height: 98, resizeMode: 'cover' },
  coverPlaceholder: { width: 68, height: 98, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0EBE0' },
  coverPlaceholderText: { fontSize: 32, color: '#C4A77D' },
  coverPlaceholderLabel: { fontSize: 8, color: '#A68A64', marginTop: 4 },
  detailsContainer: { flex: 1, marginRight: 8 },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  actionContainer: { alignItems: 'flex-end', gap: 8, justifyContent: 'space-between' },
  title: { color: '#4A3728', fontSize: 14, fontWeight: '700', lineHeight: 20, fontFamily: 'Georgia' },
  author: { color: '#8B7355', fontSize: 12, marginTop: 2, fontStyle: 'italic' },
  meta: { color: '#A68A64', fontSize: 11, marginTop: 6 },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 0, minWidth: 72, alignItems: 'center' },
  actionTxt: { color: '#FFF', fontSize: 12, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(74, 55, 40, 0.9)' },
  modalSheet: { backgroundColor: '#FFFDF9', padding: 20, maxHeight: '100%' },
  modalHeader: { alignItems: 'flex-end', marginBottom: 8 },
  modalCloseBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0EBE0', borderWidth: 1, borderColor: '#E8DCC8' },
  modalCloseTxt: { color: '#8B7355', fontSize: 16 },
  modalCoverContainer: { alignItems: 'center', marginBottom: 16 },
  modalCoverImage: { width: 150, height: 200, resizeMode: 'contain' },
  modalCoverPlaceholder: { width: 150, height: 200, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0EBE0', borderWidth: 1, borderColor: '#E8DCC8' },
  modalCoverPlaceholderText: { fontSize: 60, color: '#C4A77D' },
  modalTitle: { color: '#4A3728', fontSize: 20, fontWeight: '800', textAlign: 'center', fontFamily: 'Georgia', marginBottom: 4 },
  modalAuthor: { color: '#8B7355', fontSize: 14, textAlign: 'center', fontStyle: 'italic', marginBottom: 12 },
  modalBadgeRow: { flexDirection: 'row', gap: 6, marginBottom: 16, justifyContent: 'center', flexWrap: 'wrap' },
  modalInfoRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 8 },
  modalInfoLabel: { color: '#A68A64', fontSize: 12, fontWeight: '600' },
  modalInfoValue: { color: '#4A3728', fontSize: 12, fontFamily: 'Georgia' },
  modalDescTitle: { color: '#4A3728', fontSize: 14, fontWeight: '700', marginTop: 16, marginBottom: 8, fontFamily: 'Georgia' },
  modalDesc: { color: '#6B5744', fontSize: 13, lineHeight: 20, marginBottom: 20 },
  modalBtn: { borderRadius: 0, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  modalBtnTxt: { color: '#FFF', fontSize: 14, fontWeight: '600' },
});