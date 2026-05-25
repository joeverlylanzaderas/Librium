// screens/borrower/BorrowerHomeScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, RefreshControl, Alert, ActivityIndicator,
  Modal, ScrollView, Image, useWindowDimensions, Platform,
} from 'react-native';
import { useAlert } from '../../components/AlertProvider';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useAutoRefreshOnFocus } from '../../hooks/useAutoRefreshOnFocus';
import {
  getBooks, getCategories, getDepartments, createBorrowRequest, createReservation,
  getLoans, getReservations, getBorrowRequests, getFines,
  getBookmarks, createBookmark, deleteBookmark, // Added Bookmark API Hooks
} from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Empty, Loading } from '../../components/UI';

// ── Types ─────────────────────────────────────────────────────────
type Book = {
  id: number; title: string; author_name: string;
  category_name: string | null; department_name: string | null;
  available: boolean; isbn: string; publication_year: number;
  description: string | null; cover_image: string | null;
};
type Category = { id: number; name: string };
type Department = { id: number; name: string; description?: string };
type MemberStats = {
  active_loans: number; overdue: number; reservations: number;
  pending_requests: number; unpaid_fines: number;
};
// Matching your BookmarkSerializer output
type BookmarkItem = {
  id: number;
  book: number;
};

const STAT_CARDS = [
  { key: 'active_loans',    label: 'Active Loans',  icon: 'book-open',  color: '#C17B2E', targetScreen: 'BorrowerLoans'        },
  { key: 'overdue',         label: 'Overdue',        icon: 'alert-circle', color: '#B94040', targetScreen: 'BorrowerLoans'      },
  { key: 'reservations',    label: 'Reservations',   icon: 'bookmark',   color: '#2E7D5E', targetScreen: 'BorrowerReservations' },
  { key: 'pending_requests',label: 'Pending',        icon: 'clock',      color: '#7B5EA7', targetScreen: 'BorrowerRequests'     },
  { key: 'unpaid_fines',    label: 'Fines',          icon: 'dollar-sign',color: '#B94040', targetScreen: 'BorrowerFines'        },
] as const;

// ── Design Tokens ─────────────────────────────────────────────────
const T = {
  ink:        '#1C1008',
  inkLight:   '#4A3520',
  muted:      '#7A6350',
  faint:      '#A89880',
  paper:      '#FAF6EE',
  paperDark:  '#F2EBE0',
  paperDeep:  '#E8DFCF',
  card:       '#FFFDF8',
  white:      '#FFFFFF',

  amber:      '#C17B2E',
  amberFaint: '#FBF0DC',
  green:      '#2E7D5E',
  greenFaint: '#E8F5EF',
  red:        '#B94040',
  redFaint:   '#FAEAEA',
  purple:     '#7B5EA7',
  purpleFaint:'#F0EBF8',

  border:      '#DDD3C4',
  borderDark: '#C4B8A8',
  serif:      Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
};

// ── Stat Chip ─────────────────────────────────────────────────────
function StatChip({ label, value, icon, color, faint, onPress }: {
  label: string; value: string; icon: any; color: string; faint: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[ch.wrap, { backgroundColor: faint, borderColor: color + '44' }]} onPress={onPress} activeOpacity={0.75}>
      <View style={[ch.iconWrap, { backgroundColor: color + '18' }]}>
        <Feather name={icon} size={14} color={color} />
      </View>
      <Text style={[ch.value, { color }]}>{value}</Text>
      <Text style={ch.label}>{label}</Text>
    </TouchableOpacity>
  );
}
const ch = StyleSheet.create({
  wrap:     { alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14,
              borderWidth: 1, minWidth: 85, gap: 2 },
  iconWrap:{ width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  value:   { fontFamily: T.serif, fontSize: 18, fontWeight: '700', lineHeight: 22 },
  label:   { fontSize: 9, fontWeight: '700', color: T.muted, letterSpacing: 0.5, textTransform: 'uppercase' },
});

// ── Book Card ─────────────────────────────────────────────────────
function BookCard({ item, isLoaned, isReserved, hasPending, isBookmarked, bookmarkToggleLoading, acting, cardWidth, onPress, onAction, onBookmarkToggle }: {
  item: Book; isLoaned: boolean; isReserved: boolean; hasPending: boolean; isBookmarked: boolean; bookmarkToggleLoading: boolean;
  acting: number | null; cardWidth: number; onPress: () => void; onAction: () => void; onBookmarkToggle: () => void;
}) {
  const isDisabled = isReserved || isLoaned || hasPending;
  let btnLabel = 'Borrow';
  let btnColor = T.amber;
  if (hasPending)      { btnLabel = 'Pending';  btnColor = T.purple; }
  else if (isReserved) { btnLabel = 'Reserved'; btnColor = T.green;  }
  else if (isLoaned)   { btnLabel = 'On Loan';  btnColor = T.muted;  }
  else if (!item.available) { btnLabel = 'Reserve'; btnColor = T.green; }

  return (
    <TouchableOpacity style={[bc.card, { width: cardWidth }]} onPress={onPress} activeOpacity={0.88}>
      <View style={bc.coverContainer}>
        {item.cover_image ? (
          <Image source={{ uri: item.cover_image }} style={bc.cover} resizeMode="cover" />
        ) : (
          <View style={bc.coverPlaceholder}>
            <Feather name="book" size={32} color={T.faint} />
          </View>
        )}
        
        {/* Floating Interactive Bookmark Toggle Icon Component */}
        <TouchableOpacity 
          style={bc.bookmarkIconFloating} 
          onPress={onBookmarkToggle}
          disabled={bookmarkToggleLoading}
          activeOpacity={0.7}
        >
          {bookmarkToggleLoading ? (
            <ActivityIndicator size="small" color={T.amber} />
          ) : (
            <Feather 
              name={isBookmarked ? "bookmark" : "plus"} 
              size={14} 
              color={isBookmarked ? T.white : T.ink} 
            />
          )}
        </TouchableOpacity>

        <View style={[bc.badgeOverlay, { backgroundColor: item.available ? T.green : T.red }]}>
          <Text style={bc.badgeOverlayTxt}>{item.available ? 'ON THE SHELF' : 'ON LOAN'}</Text>
        </View>
      </View>

      <View style={bc.body}>
        <Text style={bc.title} numberOfLines={2}>{item.title}</Text>
        <Text style={bc.author} numberOfLines={1}>{item.author_name}</Text>
        
        <View style={bc.metaInfoRow}>
          {item.category_name && (
            <View style={bc.tag}>
              <Text style={bc.tagTxt} numberOfLines={1}>{item.category_name}</Text>
            </View>
          )}
          {item.department_name && (
            <View style={[bc.tag, { backgroundColor: T.purpleFaint }]}>
              <Text style={[bc.tagTxt, { color: T.purple }]} numberOfLines={1}>{item.department_name}</Text>
            </View>
          )}
        </View>
        <Text style={bc.yearTxt}>Year: {item.publication_year}</Text>
      </View>

      <TouchableOpacity
        style={[bc.btn, { backgroundColor: btnColor, opacity: isDisabled ? 0.65 : 1 }]}
        onPress={onAction}
        disabled={acting === item.id || isDisabled}
      >
        {acting === item.id
          ? <ActivityIndicator size="small" color={T.white} />
          : <Text style={bc.btnTxt}>{btnLabel}</Text>
        }
      </TouchableOpacity>
    </TouchableOpacity>
  );
}
const bc = StyleSheet.create({
  card:     { backgroundColor: T.card, borderRadius: 12, borderWidth: 1, borderColor: T.border,
              padding: 10, marginBottom: 14, justifyContent: 'space-between', display: 'flex',
              shadowColor: T.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  coverContainer: { width: '100%', aspectRatio: 3 / 4, borderRadius: 8, overflow: 'hidden', backgroundColor: T.paperDark, position: 'relative' },
  cover:     { width: '100%', height: '100%' },
  coverPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  bookmarkIconFloating: {
    position: 'absolute',
    top: 6,
    left: 6,
    zIndex: 5,
    backgroundColor: 'rgba(185, 143, 15, 0.9)',
    width: 28,
    height: 28,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: T.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  badgeOverlay: { position: 'absolute', top: 6, right: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeOverlayTxt: { color: T.white, fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  body:     { paddingVertical: 8, flex: 1, gap: 4 },
  title:    { fontFamily: T.serif, fontSize: 13, color: T.ink, fontWeight: '700', lineHeight: 17 },
  author:   { fontSize: 11, color: T.muted, fontStyle: 'italic' },
  metaInfoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  tag:      { backgroundColor: T.amberFaint, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  tagTxt:   { fontSize: 9, color: T.amber, fontWeight: '700' },
  yearTxt:  { fontSize: 10, color: T.faint, marginTop: 2 },
  btn:      { width: '100%', paddingVertical: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  btnTxt:   { color: T.white, fontSize: 11, fontWeight: '800' },
});

// ── Book Detail Modal ─────────────────────────────────────────────
function BookModal({ book, acting, isDisabled, isReserved, isLoaned, onClose, onAction }: {
  book: Book | null; acting: number | null; isDisabled: boolean;
  isReserved: boolean; isLoaned: boolean; onClose: () => void; onAction: () => void;
}) {
  if (!book) return null;
  const available = book.available;
  const btnLabel = isLoaned ? 'You Have This Book' : isReserved ? 'Already Reserved'
    : available ? 'Request to Borrow' : 'Join Waitlist';

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={md.overlay}>
        <View style={md.sheet}>
          <View style={md.handle} />
          <ScrollView contentContainerStyle={md.scroll} showsVerticalScrollIndicator={false}>
            <TouchableOpacity style={md.closeBtn} onPress={onClose}>
              <Feather name="x" size={18} color={T.muted} />
            </TouchableOpacity>

            <View style={md.coverWrap}>
              {book.cover_image ? (
                <Image source={{ uri: book.cover_image }} style={md.cover} resizeMode="cover" />
              ) : (
                <View style={md.coverPlaceholder}>
                  <Feather name="book-open" size={48} color={T.paperDeep} />
                </View>
              )}
            </View>

            <View style={[md.statusPill, { backgroundColor: available ? T.greenFaint : T.redFaint }]}>
              <View style={[md.statusDot, { backgroundColor: available ? T.green : T.red }]} />
              <Text style={[md.statusTxt, { color: available ? T.green : T.red }]}>
                {available ? 'Available on Shelf' : 'Currently Checked Out'}
              </Text>
            </View>

            <Text style={md.title}>{book.title}</Text>
            <Text style={md.author}>by {book.author_name}</Text>

            <View style={md.metaRow}>
              {book.category_name && (
                <View style={md.metaChip}><Text style={md.metaChipTxt}>{book.category_name}</Text></View>
              )}
              {book.department_name && (
                <View style={[md.metaChip, { backgroundColor: T.purpleFaint }]}>
                  <Text style={[md.metaChipTxt, { color: T.purple }]}>{book.department_name}</Text>
                </View>
              )}
            </View>

            <View style={md.infoGrid}>
              <View style={md.infoItem}>
                <Text style={md.infoKey}>ISBN</Text>
                <Text style={md.infoVal}>{book.isbn}</Text>
              </View>
              <View style={md.infoItem}>
                <Text style={md.infoKey}>Year</Text>
                <Text style={md.infoVal}>{book.publication_year}</Text>
              </View>
            </View>

            {book.description && (
              <>
                <Text style={md.synopsisLabel}>Synopsis</Text>
                <Text style={md.synopsis}>{book.description}</Text>
              </>
            )}
          </ScrollView>

          <View style={md.footer}>
            <TouchableOpacity
              style={[md.cta, { backgroundColor: available ? T.amber : T.green, opacity: isDisabled ? 0.5 : 1 }]}
              onPress={() => { onClose(); onAction(); }}
              disabled={acting === book.id || isDisabled}
            >
              {acting === book.id
                ? <ActivityIndicator color={T.white} />
                : <>
                    <Feather name={available ? 'book-open' : 'bookmark'} size={16} color={T.white} />
                    <Text style={md.ctaTxt}>{btnLabel}</Text>
                  </>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
const md = StyleSheet.create({
  overlay:        { flex: 1, backgroundColor: 'rgba(28,16,8,0.6)', justifyContent: 'flex-end' },
  sheet:          { backgroundColor: T.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '90%', paddingTop: 12 },
  handle:         { width: 40, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  scroll:         { paddingHorizontal: 22, paddingBottom: 16 },
  closeBtn:       { alignSelf: 'flex-end', padding: 4, marginBottom: 4 },
  coverWrap:      { alignItems: 'center', marginBottom: 16 },
  cover:          { width: 130, height: 180, borderRadius: 10 },
  coverPlaceholder: { width: 130, height: 180, borderRadius: 10, backgroundColor: T.paperDeep, justifyContent: 'center', alignItems: 'center' },
  statusPill:     { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginBottom: 12 },
  statusDot:      { width: 7, height: 7, borderRadius: 4 },
  statusTxt:      { fontSize: 12, fontWeight: '700' },
  title:          { fontFamily: T.serif, fontSize: 20, color: T.ink, fontWeight: '700', textAlign: 'center', lineHeight: 26, marginBottom: 6 },
  author:         { fontSize: 13, color: T.muted, fontStyle: 'italic', textAlign: 'center', marginBottom: 14 },
  metaRow:        { flexDirection: 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 },
  metaChip:       { backgroundColor: T.amberFaint, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  metaChipTxt:    { fontSize: 11, fontWeight: '700', color: T.amber },
  infoGrid:       { flexDirection: 'row', gap: 12, marginBottom: 18 },
  infoItem:       { flex: 1, backgroundColor: T.paperDark, borderRadius: 10, padding: 12, alignItems: 'center' },
  infoKey:        { fontSize: 10, fontWeight: '800', color: T.faint, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  infoVal:        { fontFamily: T.serif, fontSize: 13, color: T.ink, fontWeight: '600' },
  synopsisLabel:  { fontSize: 12, fontWeight: '800', color: T.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  synopsis:       { fontSize: 14, color: T.inkLight, lineHeight: 22 },
  footer:         { padding: 20, paddingTop: 12, borderTopWidth: 1, borderColor: T.border },
  cta:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 14, paddingVertical: 14 },
  ctaTxt:         { color: T.white, fontSize: 14, fontWeight: '800' },
});

// ── Main Screen ───────────────────────────────────────────────────
export default function BorrowerHomeScreen() {
  const { user, signOut } = useAuth();
  const navigation        = useNavigation<any>();
  const { showConfirm }   = useAlert();
  const { width }         = useWindowDimensions();

  const isDesktop = width >= 768;
  const numColumns = isDesktop ? Math.floor(width / 180) : 2;
  const spacing = 12;
  const cardWidth = (width - (spacing * (numColumns + 1))) / numColumns;

  // Structural State
  const [activeLoanedBookIds,   setActiveLoanedBookIds]  = useState<number[]>([]);
  const [activeReservedBookIds, setActiveReservedBookIds] = useState<number[]>([]);
  const [activeBorrowRequestIds,setActiveBorrowRequestIds] = useState<number[]>([]);
  const [bookmarks,             setBookmarks]             = useState<BookmarkItem[]>([]);
  const [books,       setBooks]       = useState<Book[]>([]);
  const [categories,  setCategories]  = useState<Category[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [stats,       setStats]       = useState<MemberStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [acting,      setActing]      = useState<number | null>(null);
  const [bookmarkActingId, setBookmarkActingId] = useState<number | null>(null);
  const [selected,    setSelected]    = useState<Book | null>(null);

  // Advanced Search Controls Filter States
  const [search,         setSearch]         = useState('');
  const [authorSearch,   setAuthorSearch]   = useState('');
  const [categoryId,     setCategoryId]     = useState<number | null>(null);
  const [departmentId,   setDepartmentId]   = useState<number | null>(null);
  const [filterAvail,    setFilterAvail]    = useState<'all' | 'available'>('all');
  const [pubYear,        setPubYear]        = useState('');
  const [showAdvFilters, setShowAdvFilters] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const [loans, reservations, requests, fines, bookmarkData] = await Promise.all([
        getLoans(), getReservations(), getBorrowRequests(), getFines(), getBookmarks(),
      ]);
      
      setBookmarks(bookmarkData);

      const ongoingLoans  = loans.filter((l: any) => ['none', 'pending', null].includes(l.return_status));
      const loanedIds     = ongoingLoans.map((l: any) => Number(typeof l.book === 'object' ? l.book.id : l.book)).filter(Boolean);
      setActiveLoanedBookIds(loanedIds);

      const activeRequests = requests.filter((r: any) => r.status === 'pending');
      const requestIds     = activeRequests.map((r: any) => Number(typeof r.book === 'object' ? r.book.id : r.book)).filter(Boolean);
      setActiveBorrowRequestIds(requestIds);

      const activeReservations = reservations.filter((r: any) => ['waiting', 'ready'].includes(r.status));
      const reservedIds        = activeReservations.map((r: any) => Number(typeof r.book === 'object' ? r.book.id : r.book)).filter(Boolean);
      setActiveReservedBookIds(reservedIds);

      setStats({
        active_loans:     ongoingLoans.length,
        overdue:          loans.filter((l: any) => l.is_overdue).length,
        reservations:     activeReservations.length,
        pending_requests: activeRequests.length,
        unpaid_fines:     fines.filter((f: any) => !f.paid).reduce((sum: number, f: any) => sum + parseFloat(f.amount || '0'), 0),
      });
    } catch (e) { }
    finally { setStatsLoading(false); }
  }, []);

  const loadBooks = useCallback(async () => {
    try {
      const [booksData, catData, deptData] = await Promise.all([
        getBooks(), 
        getCategories(), 
        getDepartments().catch(() => []) 
      ]);
      setBooks(booksData.map((b: any) => ({ ...b, cover_image: b.cover_image || b.cover_image_url || null })));
      setCategories(catData);
      setDepartments(deptData);
    } catch (e) { }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  const load = useCallback(async () => { await Promise.all([loadStats(), loadBooks()]); }, [loadStats, loadBooks]);

  useAutoRefreshOnFocus(load);

  // ── Engine matching Advanced Search Parameters ─────────────────
  const filtered = books.filter((b) => {
    if (search.trim() && !b.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (authorSearch.trim() && !b.author_name?.toLowerCase().includes(authorSearch.toLowerCase())) return false;

    if (categoryId) {
      const targetCatName = categories.find(c => c.id === categoryId)?.name;
      if (b.category_name?.toLowerCase() !== targetCatName?.toLowerCase()) return false;
    }

    if (departmentId) {
      const targetDeptName = departments.find(d => d.id === departmentId)?.name;
      if (b.department_name?.toLowerCase() !== targetDeptName?.toLowerCase()) return false;
    }

    if (filterAvail === 'available' && !b.available) return false;
    if (pubYear.trim() && String(b.publication_year) !== pubYear.trim()) return false;

    return true;
  });

  const clearAllFilters = () => {
    setSearch('');
    setAuthorSearch('');
    setCategoryId(null);
    setDepartmentId(null);
    setFilterAvail('all');
    setPubYear('');
  };

  // ── Toggle Bookmark Engine Action ───────────────────────────────
  const handleBookmarkToggle = async (bookId: number) => {
    setBookmarkActingId(bookId);
    const existingBookmark = bookmarks.find((b) => Number(b.book) === Number(bookId));

    try {
      if (existingBookmark) {
        // Optimistic UI updates
        setBookmarks((prev) => prev.filter((b) => b.id !== existingBookmark.id));
        await deleteBookmark(existingBookmark.id);
      } else {
        const newBookmarkRes = await createBookmark(bookId);
        setBookmarks((prev) => [...prev, newBookmarkRes]);
      }
    } catch (e: any) {
      
      Alert.alert('Bookmark Error', 'Could not sync favorite state with the cloud database right now.');
      // Re-sync with actual data if API failure happens
      const freshBookmarks = await getBookmarks().catch(() => bookmarks);
      setBookmarks(freshBookmarks);
    } finally {
      setBookmarkActingId(null);
    }
  };

  const handleBorrowRequest = async (book: Book) => {
    if (activeLoanedBookIds.map(Number).includes(Number(book.id))) {
      Alert.alert('Action Prohibited', `You cannot borrow or reserve "${book.title}" because you currently have it checked out.`);
      return;
    }
    if (activeReservedBookIds.map(Number).includes(Number(book.id))) {
      Alert.alert('Already Reserved', `You already have a reservation for "${book.title}". You will be notified when it becomes available.`);
      return;
    }
    if (!book.available) {
      showConfirm(
        `"${book.title}" is currently on loan. Would you like to join the waitlist?`,
        'This will add you to the waitlist for the next available copy.',
        async () => {
          setActing(book.id);
          try {
            await createReservation({ book: book.id });
            Alert.alert('Reserved', 'You have been added to the waitlist.');
            await load();
          } catch (e: any) {
            Alert.alert('Error', e?.data?.detail || e?.data?.error || e?.data?.book?.[0] || 'Could not create reservation.');
          } finally {
            setActing(null);
          }
        }
      );
      return;
    }
    setActing(book.id);
    try {
      await createBorrowRequest({ book: book.id });
      Alert.alert('Request Submitted', 'A librarian will process it shortly.');
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.data?.detail || e?.data?.error || e?.data?.book?.[0] || 'Could not submit request.');
    } finally { setActing(null); }
  };

  return (
    <View style={s.screenBaseContainer}>
      
      {/* FIXED TOP ARCHITECTURE CONTAINER BLOCK */}
      <View style={s.fixedHeaderWrapper}>
        <View style={s.heroTop}>
          <View>
            <Text style={s.heroSub}>WELCOME BACK</Text>
            <Text style={s.heroName}>{user?.full_name?.split(' ')[0] ?? 'Reader'}</Text>
          </View>
          <TouchableOpacity style={s.exitBtn} onPress={signOut}>
            <Feather name="log-out" size={14} color={T.muted} />
            <Text style={s.exitTxt}>Exit</Text>
          </TouchableOpacity>
        </View>

        {stats && stats.overdue > 0 && (
          <TouchableOpacity style={s.alertBanner} onPress={() => navigation.navigate('BorrowerLoans')} activeOpacity={0.8}>
            <Feather name="alert-triangle" size={13} color={T.red} />
            <Text style={s.alertTxt}>{stats.overdue} overdue {stats.overdue === 1 ? 'book' : 'books'} — tap to review</Text>
            <Feather name="chevron-right" size={13} color={T.red} />
          </TouchableOpacity>
        )}
        {stats && stats.unpaid_fines > 0 && (
          <TouchableOpacity style={[s.alertBanner, s.fineBanner]} onPress={() => navigation.navigate('BorrowerFines')} activeOpacity={0.8}>
            <Feather name="dollar-sign" size={13} color={T.amber} />
            <Text style={[s.alertTxt, { color: T.amber }]}>Unpaid fines: ₱{stats.unpaid_fines.toFixed(2)} — tap to settle</Text>
            <Feather name="chevron-right" size={13} color={T.amber} />
          </TouchableOpacity>
        )}

        {statsLoading ? (
          <View style={s.statsLoading}>
            <ActivityIndicator color={T.amber} size="small" />
            <Text style={s.statsLoadingTxt}>Loading library record…</Text>
          </View>
        ) : stats ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.statsRow}>
            {STAT_CARDS.map(({ key, label, icon, color, targetScreen }) => {
              const value = stats[key];
              const display = key === 'unpaid_fines' ? `₱${(value as number).toFixed(0)}` : String(value);
              const faintMap: Record<string, string> = {
                '#C17B2E': T.amberFaint, '#B94040': T.redFaint, '#2E7D5E': T.greenFaint, '#7B5EA7': T.purpleFaint,
              };
              return (
                <StatChip key={key} label={label} value={display} icon={icon}
                  color={color} faint={faintMap[color] ?? T.paperDark}
                  onPress={() => navigation.navigate(targetScreen)} />
              );
            })}
          </ScrollView>
        ) : null}

        {/* Catalog Control Toolbar components */}
        <View style={s.toolbar}>
          <View style={s.searchBarRow}>
            <View style={s.searchWrap}>
              <Feather name="search" size={14} color={T.faint} style={{ marginRight: 8 }} />
              <TextInput style={s.searchInput} placeholder="Search title..."
                placeholderTextColor={T.faint} value={search} onChangeText={setSearch} />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} style={{ marginRight: 6 }}>
                  <Feather name="x" size={14} color={T.faint} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity 
              style={[s.advToggleBtn, showAdvFilters && s.advToggleBtnActive]} 
              onPress={() => setShowAdvFilters(!showAdvFilters)}
            >
              <Feather name="sliders" size={14} color={showAdvFilters ? T.white : T.ink} />
              <Text style={[s.advToggleTxt, showAdvFilters && { color: T.white }]}>Filters</Text>
            </TouchableOpacity>
          </View>

          {/* ADVANCED ADV SEARCH EXPANDABLE SHELF DRAWER */}
          {showAdvFilters && (
            <View style={s.advFiltersDrawer}>
              <View style={s.advInputGridRow}>
                <View style={[s.searchWrap, { flex: 1, marginBottom: 0 }]}>
                  <Feather name="user" size={12} color={T.faint} style={{ marginRight: 6 }} />
                  <TextInput style={s.searchInput} placeholder="Author name..."
                    placeholderTextColor={T.faint} value={authorSearch} onChangeText={setAuthorSearch} />
                </View>
                <View style={[s.searchWrap, { width: 95, marginBottom: 0 }]}>
                  <Feather name="calendar" size={12} color={T.faint} style={{ marginRight: 6 }} />
                  <TextInput style={s.searchInput} placeholder="Year..."
                    keyboardType="numeric" maxLength={4}
                    placeholderTextColor={T.faint} value={pubYear} onChangeText={setPubYear} />
                </View>
              </View>

              {/* Department Selector Chips */}
              {departments.length > 0 && (
                <View style={s.drawerSubSection}>
                  <Text style={s.drawerSectionTitle}>Departments</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
                    <TouchableOpacity style={[s.chip, !departmentId && s.chipActive]} onPress={() => setDepartmentId(null)}>
                      <Text style={[s.chipTxt, !departmentId && s.chipTxtActive]}>All Departments</Text>
                    </TouchableOpacity>
                    {departments.map((dept) => (
                      <TouchableOpacity key={dept.id}
                        style={[s.chip, departmentId === dept.id && [s.chipActive, { borderColor: T.purple, backgroundColor: T.purpleFaint }]]}
                        onPress={() => setDepartmentId(departmentId === dept.id ? null : dept.id)}>
                        <Text style={[s.chipTxt, departmentId === dept.id && { color: T.purple, fontWeight: '800' }]}>{dept.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Action Reset Row */}
              <View style={s.drawerActionFooter}>
                <TouchableOpacity style={s.clearBtn} onPress={clearAllFilters}>
                  <Feather name="refresh-cw" size={11} color={T.red} style={{ marginRight: 4 }} />
                  <Text style={s.clearBtnTxt}>Reset Filters</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={s.filterRow}>
            {(['all', 'available'] as const).map((f) => (
              <TouchableOpacity key={f} style={[s.filterTab, filterAvail === f && s.filterTabActive]} onPress={() => setFilterAvail(f)}>
                <Text style={[s.filterTxt, filterAvail === f && s.filterTabTxtActive]}>
                  {f === 'all' ? 'All Books' : 'Available'}
                </Text>
              </TouchableOpacity>
            ))}
            <Text style={s.countTxt}>{filtered.length} found</Text>
          </View>

          {/* Categories Row Strip */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={s.chipRow}>
              <TouchableOpacity style={[s.chip, !categoryId && s.chipActive]} onPress={() => setCategoryId(null)}>
                <Text style={[s.chipTxt, !categoryId && s.chipTxtActive]}>All Categories</Text>
              </TouchableOpacity>
              {categories.map((cat) => (
                <TouchableOpacity key={cat.id}
                  style={[s.chip, categoryId === cat.id && s.chipActive]}
                  onPress={() => setCategoryId(categoryId === cat.id ? null : cat.id)}>
                  <Text style={[s.chipTxt, categoryId === cat.id && s.chipTxtActive]}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>

      {/* DYNAMIC SCROLLABLE BOOK ARCHIVE GRID LAYER */}
      {loading ? (
        <Loading />
      ) : (
        <FlatList
          key={numColumns}
          data={filtered}
          keyExtractor={(i) => String(i.id)}
          numColumns={numColumns}
          columnWrapperStyle={numColumns > 1 ? { gap: spacing, paddingHorizontal: spacing } : undefined}
          contentContainerStyle={[s.listContent, { paddingHorizontal: numColumns > 1 ? 0 : spacing }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} tintColor={T.amber}
              onRefresh={() => { setRefreshing(true); load(); }} />
          }
          ListEmptyComponent={
            <View style={{ paddingTop: 32 }}>
              <Empty text="No books found matching the advanced metrics filter rules." />
            </View>
          }
          renderItem={({ item }) => (
            <BookCard
              item={item}
              cardWidth={cardWidth}
              isLoaned={activeLoanedBookIds.map(Number).includes(Number(item.id))}
              isReserved={activeReservedBookIds.map(Number).includes(Number(item.id))}
              hasPending={activeBorrowRequestIds.map(Number).includes(Number(item.id))}
              isBookmarked={bookmarks.some((b) => Number(b.book) === Number(item.id))}
              bookmarkToggleLoading={bookmarkActingId === item.id}
              acting={acting}
              onPress={() => setSelected(item)}
              onAction={() => handleBorrowRequest(item)}
              onBookmarkToggle={() => handleBookmarkToggle(item.id)}
            />
          )}
        />
      )}

      {/* Details Sheet Modal overlay context */}
      {selected && (
        <BookModal
          book={selected}
          acting={acting}
          isDisabled={
            activeReservedBookIds.map(Number).includes(Number(selected?.id)) ||
            activeLoanedBookIds.map(Number).includes(Number(selected?.id))
          }
          isReserved={activeReservedBookIds.map(Number).includes(Number(selected?.id))}
          isLoaned={activeLoanedBookIds.map(Number).includes(Number(selected?.id))}
          onClose={() => setSelected(null)}
          onAction={() => handleBorrowRequest(selected)}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screenBaseContainer: { flex: 1, backgroundColor: T.paper },
  fixedHeaderWrapper: { backgroundColor: T.paper, borderBottomWidth: 1, borderColor: T.border, zIndex: 10 },
  listContent: { paddingVertical: 14 },

  heroTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 16, marginBottom: 12 },
  heroSub:      { fontSize: 9, fontWeight: '800', letterSpacing: 1.5, color: T.faint },
  heroName:     { fontFamily: T.serif, fontSize: 24, color: T.ink, fontWeight: '700', marginTop: 2 },
  exitBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: T.border, backgroundColor: T.card },
  exitTxt:      { fontSize: 11, fontWeight: '700', color: T.muted },
  alertBanner:  { flexDirection: 'row', alignItems: 'center', backgroundColor: T.redFaint, paddingVertical: 8, paddingHorizontal: 16, gap: 8, borderBottomWidth: 1, borderBottomColor: T.border },
  fineBanner:   { backgroundColor: T.amberFaint, borderBottomWidth: 0 },
  alertTxt:     { flex: 1, fontSize: 11, fontWeight: '700', color: T.red },
  statsLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  statsLoadingTxt: { fontSize: 12, color: T.muted, fontWeight: '500' },
  statsRow:     { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  
  toolbar:      { paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  searchBarRow: { flexDirection: 'row', gap: 8 },
  searchWrap:   { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: T.paperDark, borderRadius: 10, paddingHorizontal: 10, height: 36 },
  searchInput:  { flex: 1, fontSize: 13, color: T.ink, fontWeight: '500', padding: 0 },
  advToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.paperDark, borderRadius: 10, paddingHorizontal: 12, height: 36 },
  advToggleBtnActive: { backgroundColor: T.ink },
  advToggleTxt: { fontSize: 12, fontWeight: '700', color: T.ink },
  
  advFiltersDrawer: { backgroundColor: T.card, borderRadius: 12, borderWidth: 1, borderColor: T.border, padding: 12, gap: 10, marginTop: 2 },
  advInputGridRow:  { flexDirection: 'row', gap: 8 },
  drawerSubSection: { gap: 6 },
  drawerSectionTitle: { fontSize: 10, fontWeight: '800', color: T.muted, letterSpacing: 0.5, textTransform: 'uppercase' },
  drawerActionFooter: { flexDirection: 'row', justifyContent: 'flex-end', borderTopWidth: 1, borderColor: T.paperDark, paddingTop: 8, marginTop: 2 },
  clearBtn:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8 },
  clearBtnTxt:  { fontSize: 11, fontWeight: '700', color: T.red },
  
  filterRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },
  filterTab:    { paddingVertical: 4 },
  filterTabActive: { borderBottomWidth: 2, borderBottomColor: T.amber },
  filterTxt:    { fontSize: 13, fontWeight: '600', color: T.muted },
  filterTabTxtActive: { color: T.amber, fontWeight: '700' },
  countTxt:     { marginLeft: 'auto', fontSize: 11, fontWeight: '600', color: T.faint },
  
  chipRow:      { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  chip:         { backgroundColor: T.paperDark, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'transparent' },
  chipActive:   { backgroundColor: T.amberFaint, borderColor: T.amber },
  chipTxt:      { fontSize: 11, fontWeight: '600', color: T.muted },
  chipTxtActive: { color: T.amber, fontWeight: '700' },
});