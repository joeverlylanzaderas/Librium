import { getReservations, fulfillReservation } from '../../services/api';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, Modal, ActivityIndicator,
  Platform, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Empty, Loading } from '../../components/UI';

// ── Warm library palette (matches admin ReservationsScreen) ───
const P = {
  mahogany:     '#412D15',
  espresso:     '#1F150C',
  amber:        '#F69D39',
  brass:        '#FFC85C',
  parchment:    '#FBF5DD',
  parchmentDark:'#EFE9CE',
  pureWhite:    '#FFFFFF',
  textMain:     '#2D1F10',
  textMuted:    '#706251',
  success:      '#3D5A45',
  danger:       '#8A2B2B',
};

const SERIF_FONT = Platform.select({ ios: 'Georgia', android: 'serif' });

const STATUS_META: Record<string, { bg: string; text: string }> = {
  waiting:   { bg: '#FFF9E6', text: P.amber },
  ready:     { bg: '#EAF2EC', text: P.success },
  fulfilled: { bg: '#D4E8D4', text: '#2E5E2E' },
  cancelled: { bg: '#F1EDE4', text: P.textMuted },
  expired:   { bg: '#FCEAEA', text: P.danger },
};

type Reservation = {
  id:             number;
  member_name:    string;
  book_title:     string;
  book_author:    string | null;
  status:         string;
  reserved_date:  string;
  notified_date:  string | null;
  queue_position: number;
  member?:        number;
  book?:          number;
};

export default function LibrarianReservationsScreen() {
  const { width } = useWindowDimensions();
  const [reservations, setReservations]           = useState<Reservation[]>([]);
  const [loading, setLoading]                     = useState(true);
  const [refreshing, setRefreshing]               = useState(false);
  const [processingId, setProcessingId]           = useState<number | null>(null);
  const [modalVisible, setModalVisible]           = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getReservations();
      setReservations(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openFulfillModal = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setModalVisible(true);
  };

  const handleFulfillReservation = async () => {
    if (!selectedReservation) return;
    setProcessingId(selectedReservation.id);
    setModalVisible(false);
    try {
      await fulfillReservation(selectedReservation.id);
      Alert.alert('Success', 'Loan created successfully!');
      load();
    } catch (e: any) {
      const msg = e?.data?.error ?? e?.data?.detail ?? 'Could not create loan. Make sure the book is available.';
      Alert.alert('Error', msg);
    } finally {
      setProcessingId(null);
      setSelectedReservation(null);
    }
  };

  const contentStyle = width > 1200
    ? { maxWidth: 1200, alignSelf: 'center' as const, width: '100%' as any }
    : {};

  if (loading) return <Loading />;

  const readyReservations   = reservations.filter(r => r.status === 'ready');
  const waitingReservations = reservations.filter(r => r.status === 'waiting');
  const otherReservations   = reservations.filter(r => !['waiting', 'ready'].includes(r.status));

  const renderRow = (item: Reservation, idx: number, total: number, showFulfill: boolean) => {
    const meta = STATUS_META[item.status] ?? { bg: '#F1EDE4', text: P.textMuted };
    return (
      <View key={item.id} style={[s.actRow, idx !== total - 1 && s.actBorder]}>
        <View style={[s.actIcon, { backgroundColor: meta.text + '15' }]}>
          <Ionicons
            name={showFulfill ? 'book-outline' : 'time-outline'}
            size={14}
            color={meta.text}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.actLabel}>{item.book_title}</Text>
          <Text style={s.actMeta} numberOfLines={1}>
            Member: {item.member_name}  ·  Reserved: {item.reserved_date}
          </Text>
          <Text style={s.actMeta}>Queue #{item.queue_position}</Text>
          {item.notified_date && (
            <Text style={[s.actMeta, { color: P.success }]}>
              Notified: {item.notified_date}
            </Text>
          )}
        </View>

        {showFulfill ? (
          <TouchableOpacity
            style={[s.fulfillBtn, processingId === item.id && { opacity: 0.5 }]}
            onPress={() => openFulfillModal(item)}
            disabled={processingId === item.id}
          >
            {processingId === item.id
              ? <ActivityIndicator size="small" color={P.pureWhite} />
              : <>
                  <Ionicons name="checkmark" size={15} color={P.pureWhite} />
                  <Text style={s.fulfillBtnTxt}>Issue Loan</Text>
                </>
            }
          </TouchableOpacity>
        ) : (
          <View style={[s.statusBadge, { backgroundColor: meta.bg }]}>
            <Text style={[s.statusTxt, { color: meta.text }]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.inner}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }}
          tintColor={P.amber}
        />
      }
    >
      <View style={contentStyle}>

        {/* Page heading */}
        <View style={s.titleWrap}>
          <Text style={s.title}>Reservation Queue</Text>
          <Text style={s.subtitle}>Manage member waitlist ({reservations.length} total)</Text>
        </View>

        {/* Ready to fulfill */}
        {readyReservations.length > 0 && (
          <>
            <Text style={s.sectionLabel}>READY TO FULFILL</Text>
            <View style={s.panel}>
              <View style={[s.panelHeader, { backgroundColor: P.success }]}>
                <Ionicons name="checkmark-circle" size={14} color={P.pureWhite} />
                <Text style={s.panelHeaderTxt}>Ready for Checkout</Text>
              </View>
              {readyReservations.map((r, i) =>
                renderRow(r, i, readyReservations.length, true)
              )}
            </View>
          </>
        )}

        {/* Waiting queue */}
        {waitingReservations.length > 0 && (
          <>
            <Text style={s.sectionLabel}>WAITING QUEUE</Text>
            <View style={s.panel}>
              <View style={s.panelHeader}>
                <Ionicons name="time-outline" size={14} color={P.brass} />
                <Text style={s.panelHeaderTxt}>Pending Availability</Text>
              </View>
              {waitingReservations.map((r, i) =>
                renderRow(r, i, waitingReservations.length, false)
              )}
            </View>
          </>
        )}

        {/* Archived */}
        {otherReservations.length > 0 && (
          <>
            <Text style={s.sectionLabel}>ARCHIVED</Text>
            <View style={s.panel}>
              <View style={[s.panelHeader, { backgroundColor: P.textMuted }]}>
                <Ionicons name="archive-outline" size={14} color={P.pureWhite} />
                <Text style={s.panelHeaderTxt}>Completed Records</Text>
              </View>
              {otherReservations.map((r, i) =>
                renderRow(r, i, otherReservations.length, false)
              )}
            </View>
          </>
        )}

        {reservations.length === 0 && <Empty text="No reservations in the queue." />}

      </View>

      {/* Confirm modal */}
      <Modal
        animationType="fade"
        transparent
        visible={modalVisible}
        onRequestClose={() => { setModalVisible(false); setSelectedReservation(null); }}
      >
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Confirm Loan Creation</Text>
            <Text style={s.modalMsg}>
              Create a loan for{'\n'}
              <Text style={{ fontWeight: '700', color: P.espresso }}>
                "{selectedReservation?.book_title}"
              </Text>
              {'\n'}to {selectedReservation?.member_name}?
            </Text>
            <View style={s.modalBtns}>
              <TouchableOpacity
                style={[s.modalBtn, s.modalCancel]}
                onPress={() => { setModalVisible(false); setSelectedReservation(null); }}
              >
                <Text style={s.modalCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: P.success }]}
                onPress={handleFulfillReservation}
              >
                <Text style={s.modalConfirmTxt}>Create Loan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: '#FCFAEE' },
  inner: { paddingBottom: 48, paddingTop: 20 },

  titleWrap:  { paddingHorizontal: 16, marginBottom: 16 },
  title:      { fontSize: 26, fontWeight: '700', fontFamily: SERIF_FONT, color: P.espresso },
  subtitle:   { fontSize: 13, fontWeight: '500', color: P.textMuted, marginTop: 3 },

  sectionLabel: {
    color: P.textMuted, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.2, marginTop: 12, marginBottom: 8, marginHorizontal: 16,
  },

  panel: {
    marginHorizontal: 16, backgroundColor: P.pureWhite,
    borderRadius: 6, borderWidth: 1, borderColor: P.parchmentDark,
    overflow: 'hidden', marginBottom: 12,
  },
  panelHeader: {
    backgroundColor: P.espresso, flexDirection: 'row',
    alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10,
  },
  panelHeaderTxt: { color: P.parchment, fontSize: 13, fontWeight: '600', fontFamily: SERIF_FONT },

  actRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  actBorder:{ borderBottomWidth: 1, borderBottomColor: P.amber },
  actIcon:  { width: 32, height: 32, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  actLabel: { color: P.textMain, fontSize: 13, fontWeight: '600' },
  actMeta:  { color: P.textMuted, fontSize: 12, marginTop: 3 },

  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignSelf: 'center' },
  statusTxt:   { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

  fulfillBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: P.success, paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 4, minWidth: 110, justifyContent: 'center',
  },
  fulfillBtnTxt: { color: P.pureWhite, fontSize: 12, fontWeight: '600' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modal: {
    backgroundColor: P.pureWhite, borderRadius: 8, padding: 24,
    width: '80%', maxWidth: 320, borderWidth: 1, borderColor: P.parchmentDark,
  },
  modalTitle:      { fontSize: 17, fontWeight: '700', fontFamily: SERIF_FONT, color: P.espresso, marginBottom: 12, textAlign: 'center' },
  modalMsg:        { fontSize: 14, color: P.textMain, marginBottom: 20, textAlign: 'center', lineHeight: 22 },
  modalBtns:       { flexDirection: 'row', gap: 12 },
  modalBtn:        { flex: 1, paddingVertical: 11, borderRadius: 4, alignItems: 'center' },
  modalCancel:     { backgroundColor: '#F1EDE4', borderWidth: 1, borderColor: P.parchmentDark },
  modalCancelTxt:  { color: P.textMuted, fontWeight: '600' },
  modalConfirmTxt: { color: P.pureWhite, fontWeight: '600' },
});