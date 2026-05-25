import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, RefreshControl, Modal,
  ScrollView, Alert, useWindowDimensions, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getBookmarks, deleteBookmark, createBorrowRequest, createReservation, getLoans, getReservations, getBorrowRequests } from '../../services/api';
import { Empty, Loading } from '../../components/UI';

// ── Types ─────────────────────────────────────────────────────────
interface BookmarkItem {
  id: number;
  member: number;
  book: number;
  book_title: string;
  book_cover: string | null;
  bookmarked_date: string;
}

// ── Design tokens (identical to BorrowerHomeScreen) ───────────────
const T = {
  ink:        '#1C1008', inkLight: '#4A3520', muted: '#7A6350', faint: '#A89880',
  paper:      '#FAF6EE', paperDark: '#F2EBE0', paperDeep: '#E8DFCF',
  card:       '#FFFDF8', white: '#FFFFFF',
  amber:      '#C17B2E', amberFaint: '#FBF0DC',
  green:      '#2E7D5E', greenFaint: '#E8F5EF',
  red:        '#B94040', redFaint:   '#FAEAEA',
  purple:     '#7B5EA7', purpleFaint:'#F0EBF8',
  border:     '#DDD3C4', borderDark: '#C4B8A8',
  serif:      Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
};

// ── Bookmark Card (matches BookCard in BorrowerHomeScreen) ────────
function BookmarkCard({
  item, acting, onRemove, onAction, cardWidth,
  isLoaned, isReserved, hasPending,
}: {
  item: BookmarkItem; acting: number | null; onRemove: () => void;
  onAction: () => void; cardWidth: number;
  isLoaned: boolean; isReserved: boolean; hasPending: boolean;
}) {
  const isDisabled = isLoaned || isReserved || hasPending;
  let btnLabel = 'Borrow';
  let btnColor = T.amber;
  if (hasPending)      { btnLabel = 'Pending';  btnColor = T.purple; }
  else if (isReserved) { btnLabel = 'Reserved'; btnColor = T.green;  }
  else if (isLoaned)   { btnLabel = 'On Loan';  btnColor = T.muted;  }

  return (
    <View style={[bc.card, { width: cardWidth }]}>
      <View style={bc.coverContainer}>
        {item.book_cover ? (
          <Image source={{ uri: item.book_cover }} style={bc.cover} resizeMode="cover" />
        ) : (
          <View style={bc.coverPlaceholder}>
            <Feather name="book" size={32} color={T.faint} />
          </View>
        )}

        {/* Remove bookmark button */}
        <TouchableOpacity
          style={bc.removeBtn}
          onPress={onRemove}
          disabled={acting === item.id}
          activeOpacity={0.75}
        >
          {acting === item.id
            ? <ActivityIndicator size="small" color={T.amber} />
            : <Feather name="bookmark" size={14} color={T.white} />
          }
        </TouchableOpacity>
      </View>

      <View style={bc.body}>
        <Text style={bc.title} numberOfLines={2}>{item.book_title}</Text>
        <Text style={bc.date}>Saved {new Date(item.bookmarked_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
      </View>

      <TouchableOpacity
        style={[bc.btn, { backgroundColor: btnColor, opacity: isDisabled ? 0.65 : 1 }]}
        onPress={onAction}
        disabled={isDisabled}
      >
        <Text style={bc.btnTxt}>{btnLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const bc = StyleSheet.create({
  card:           { backgroundColor: T.card, borderRadius: 12, borderWidth: 1, borderColor: T.border,
                    padding: 10, marginBottom: 14, justifyContent: 'space-between',
                    shadowColor: T.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  coverContainer: { width: '100%', aspectRatio: 3/4, borderRadius: 8, overflow: 'hidden', backgroundColor: T.paperDark, position: 'relative' },
  cover:          { width: '100%', height: '100%' },
  coverPlaceholder:{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  removeBtn:      { position: 'absolute', top: 6, left: 6, zIndex: 5,
                    backgroundColor: T.amber, width: 26, height: 26, borderRadius: 13,
                    justifyContent: 'center', alignItems: 'center',
                    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 3 },
  body:           { paddingVertical: 8, gap: 3 },
  title:          { fontFamily: T.serif, fontSize: 13, color: T.ink, fontWeight: '700', lineHeight: 17 },
  date:           { fontSize: 10, color: T.faint, fontStyle: 'italic' },
  btn:            { width: '100%', paddingVertical: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  btnTxt:         { color: T.white, fontSize: 11, fontWeight: '800' },
});

// ── Main Screen ───────────────────────────────────────────────────
export default function BorrowerBookmarkScreen() {
  const { width } = useWindowDimensions();

  const isDesktop  = width >= 768;
  const numColumns = isDesktop ? Math.floor(width / 180) : 2;
  const spacing    = 12;
  const cardWidth  = (width - spacing * (numColumns + 1)) / numColumns;

  const [bookmarks,  setBookmarks]  = useState<BookmarkItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting,     setActing]     = useState<number | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  // Track loan/reservation state for action buttons
  const [loanedIds,   setLoanedIds]   = useState<number[]>([]);
  const [reservedIds, setReservedIds] = useState<number[]>([]);
  const [requestIds,  setRequestIds]  = useState<number[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [data, loans, reservations, requests] = await Promise.all([
        getBookmarks(),
        getLoans(),
        getReservations(),
        getBorrowRequests(),
      ]);
      setBookmarks(data);

      const ongoing = loans.filter((l: any) => ['none', 'pending', null].includes(l.return_status));
      setLoanedIds(ongoing.map((l: any) => Number(typeof l.book === 'object' ? l.book.id : l.book)).filter(Boolean));

      const activeRes = reservations.filter((r: any) => ['waiting', 'ready'].includes(r.status));
      setReservedIds(activeRes.map((r: any) => Number(typeof r.book === 'object' ? r.book.id : r.book)).filter(Boolean));

      const activeReq = requests.filter((r: any) => r.status === 'pending');
      setRequestIds(activeReq.map((r: any) => Number(typeof r.book === 'object' ? r.book.id : r.book)).filter(Boolean));
    } catch (err: any) {
      setError(err?.data?.detail || 'Failed to load bookmarks.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleRemove = async (item: BookmarkItem) => {
    setActing(item.id);
    try {
      setBookmarks((prev) => prev.filter((b) => b.id !== item.id)); // optimistic
      await deleteBookmark(item.id);
    } catch (e: any) {
      Alert.alert('Error', 'Could not remove bookmark.');
      await load(); // re-sync
    } finally {
      setActing(null);
    }
  };

  const handleBorrowAction = async (item: BookmarkItem) => {
    const bookId = item.book;

    if (loanedIds.includes(bookId)) {
      Alert.alert('On Loan', 'You already have this book checked out.');
      return;
    }
    if (reservedIds.includes(bookId)) {
      Alert.alert('Already Reserved', 'You already have a reservation for this book.');
      return;
    }

    setActing(item.id);
    try {
      await createBorrowRequest({ book: bookId });
      Alert.alert('Request Submitted', 'A librarian will process it shortly.');
      await load();
    } catch (e: any) {
      const msg = e?.data?.detail || e?.data?.error || e?.data?.book?.[0] || 'Could not submit request.';
      Alert.alert('Error', msg);
    } finally {
      setActing(null);
    }
  };

  if (loading) return <Loading />;

  if (error) {
    return (
      <View style={s.centered}>
        <Feather name="wifi-off" size={32} color={T.faint} />
        <Text style={s.errorTxt}>{error}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={() => { setLoading(true); load(); }}>
          <Feather name="refresh-cw" size={13} color={T.white} />
          <Text style={s.retryTxt}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerSub}>YOUR COLLECTION</Text>
        <Text style={s.headerTitle}>Saved Books</Text>
        {bookmarks.length > 0 && (
          <Text style={s.headerCount}>{bookmarks.length} {bookmarks.length === 1 ? 'book' : 'books'} bookmarked</Text>
        )}
      </View>

      <FlatList
        key={numColumns}
        data={bookmarks}
        keyExtractor={(i) => String(i.id)}
        numColumns={numColumns}
        columnWrapperStyle={numColumns > 1 ? { gap: spacing, paddingHorizontal: spacing } : undefined}
        contentContainerStyle={[s.listContent, { paddingHorizontal: numColumns > 1 ? 0 : spacing }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} tintColor={T.amber}
            onRefresh={() => { setRefreshing(true); load(); }} />
        }
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <Feather name="bookmark" size={40} color={T.paperDeep} />
            <Text style={s.emptyTitle}>Your shelf is empty</Text>
            <Text style={s.emptySub}>Tap the bookmark icon on any book in the catalog to save it here.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <BookmarkCard
            item={item}
            cardWidth={cardWidth}
            acting={acting}
            isLoaned={loanedIds.includes(item.book)}
            isReserved={reservedIds.includes(item.book)}
            hasPending={requestIds.includes(item.book)}
            onRemove={() => handleRemove(item)}
            onAction={() => handleBorrowAction(item)}
          />
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: T.paper },
  header:      { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 14,
                 borderBottomWidth: 1, borderColor: T.border, backgroundColor: T.paperDark },
  headerSub:   { fontSize: 9, fontWeight: '800', letterSpacing: 2, color: T.faint },
  headerTitle: { fontFamily: T.serif, fontSize: 24, color: T.ink, fontWeight: '700', marginTop: 2 },
  headerCount: { fontSize: 11, color: T.muted, fontWeight: '600', marginTop: 4 },
  listContent: { paddingVertical: 14 },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
  errorTxt:    { fontSize: 14, color: T.muted, textAlign: 'center' },
  retryBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.amber,
                 paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10 },
  retryTxt:    { color: T.white, fontWeight: '700', fontSize: 13 },
  emptyWrap:   { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40, gap: 12 },
  emptyTitle:  { fontFamily: T.serif, fontSize: 18, color: T.inkLight, fontWeight: '700' },
  emptySub:    { fontSize: 13, color: T.muted, textAlign: 'center', lineHeight: 20 },
});