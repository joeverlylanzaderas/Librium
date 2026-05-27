// admin/ReservationsScreen.tsx
import React, { useEffect, useState } from 'react';
import { Text, ScrollView, StyleSheet, RefreshControl, View, Platform, useWindowDimensions, Alert, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getReservations, fulfillReservation, normalizePaginated } from '../../services/api';
import { useAutoRefreshOnFocus } from '../../hooks/useAutoRefreshOnFocus';
import { Empty, Loading } from '../../components/UI';

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
  id: number;
  book: number;
  book_title?: string;
  member: number;
  member_name?: string;
  reservation_date: string;
  expiry_date?: string;
  status: string;
  queue_position?: number;
};

export default function ReservationsScreen() {
  const { width } = useWindowDimensions();
  const [items, setItems] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

  const load = async () => {
    try {
      const data = await getReservations();
      setItems(normalizePaginated(data));
    } catch (e) { }
    finally { setLoading(false); setRefreshing(false); }
  };

  useAutoRefreshOnFocus(load);

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
      await load();
    } catch (e: any) {
      
      const errorMsg = e?.data?.error || e?.data?.detail || 'Could not create loan. Make sure the book is available.';
      Alert.alert('Error', errorMsg);
    } finally {
      setProcessingId(null);
      setSelectedReservation(null);
    }
  };

  const isDesktop = width > 768;
  const contentStyle = width > 1200 ? { maxWidth: 1200, alignSelf: 'center' as const, width: '100%' as any } : {};

  if (loading) return <Loading />;

  const waitingReservations = items.filter(r => r.status === 'waiting');
  const readyReservations = items.filter(r => r.status === 'ready');
  const otherReservations = items.filter(r => !['waiting', 'ready'].includes(r.status));

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={[s.inner, { paddingTop: isDesktop ? 24 : 16 }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }}
          tintColor={P.amber}
        />
      }
    >
      <View style={contentStyle}>
        <View style={s.mainTitleWrap}>
          <Text style={s.mainDashboardTitle}>Reservation Queue</Text>
          <Text style={s.dateText}>Manage member waitlist ({items.length} total)</Text>
        </View>

        {readyReservations.length > 0 && (
          <>
            <Text style={s.sectionLabel}>READY TO FULFILL</Text>
            <View style={s.panel}>
              <View style={[s.panelHeader, { backgroundColor: P.success }]}>
                <Ionicons name="checkmark-circle" size={14} color={P.pureWhite} />
                <Text style={s.panelHeaderTxt}>Ready for Checkout</Text>
              </View>
              {readyReservations.map((r, idx) => {
                const meta = STATUS_META[r.status] || { bg: '#F1EDE4', text: P.textMuted };
                return (
                  <View key={r.id} style={[s.actRow, idx !== readyReservations.length - 1 && s.actBorder]}>
                    <View style={[s.actIcon, { backgroundColor: meta.text + '15' }]}>
                      <Ionicons name="book-outline" size={14} color={meta.text} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.actLabel}>{r.book_title}</Text>
                      <Text style={s.actMeta} numberOfLines={1}>
                        Member: {r.member_name || r.member} · Reserved: {new Date(r.reservation_date).toLocaleDateString()}
                      </Text>
                      {r.queue_position !== undefined && (
                        <Text style={s.actMeta}>Queue Position: #{r.queue_position}</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={[s.approveBtn, processingId === r.id && s.approveBtnDisabled]}
                      onPress={() => openFulfillModal(r)}
                      disabled={processingId === r.id}
                    >
                      {processingId === r.id ? (
                        <ActivityIndicator size="small" color={P.pureWhite} />
                      ) : (
                        <>
                          <Ionicons name="checkmark" size={16} color={P.pureWhite} />
                          <Text style={s.approveBtnText}>Create Loan</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {waitingReservations.length > 0 && (
          <>
            <Text style={s.sectionLabel}>WAITING QUEUE</Text>
            <View style={s.panel}>
              <View style={s.panelHeader}>
                <Ionicons name="time-outline" size={14} color={P.brass} />
                <Text style={s.panelHeaderTxt}>Pending Availability</Text>
              </View>
              {waitingReservations.map((r, idx) => {
                const meta = STATUS_META[r.status] || { bg: '#F1EDE4', text: P.textMuted };
                return (
                  <View key={r.id} style={[s.actRow, idx !== waitingReservations.length - 1 && s.actBorder]}>
                    <View style={[s.actIcon, { backgroundColor: meta.text + '15' }]}>
                      <Ionicons name="time-outline" size={14} color={meta.text} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.actLabel}>{r.book_title}</Text>
                      <Text style={s.actMeta} numberOfLines={1}>
                        Member: {r.member_name || r.member} · Reserved: {new Date(r.reservation_date).toLocaleDateString()}
                      </Text>
                      {r.queue_position !== undefined && (
                        <Text style={s.actMeta}>Queue Position: #{r.queue_position}</Text>
                      )}
                      {r.expiry_date && (
                        <Text style={[s.actMeta, { color: P.danger }]} numberOfLines={1}>
                          Expires: {new Date(r.expiry_date).toLocaleDateString()}
                        </Text>
                      )}
                    </View>
                    <View style={[s.statusBadge, { backgroundColor: meta.bg }]}>
                      <Text style={[s.statusText, { color: meta.text }]}>{r.status.toUpperCase()}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {otherReservations.length > 0 && (
          <>
            <Text style={s.sectionLabel}>ARCHIVED</Text>
            <View style={s.panel}>
              <View style={[s.panelHeader, { backgroundColor: P.textMuted }]}>
                <Ionicons name="archive-outline" size={14} color={P.pureWhite} />
                <Text style={s.panelHeaderTxt}>Completed Records</Text>
              </View>
              {otherReservations.map((r, idx) => {
                const meta = STATUS_META[r.status] || { bg: '#F1EDE4', text: P.textMuted };
                return (
                  <View key={r.id} style={[s.actRow, idx !== otherReservations.length - 1 && s.actBorder]}>
                    <View style={[s.actIcon, { backgroundColor: meta.text + '15' }]}>
                      <Ionicons name="checkmark-done-outline" size={14} color={meta.text} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.actLabel}>{r.book_title}</Text>
                      <Text style={s.actMeta} numberOfLines={1}>
                        Member: {r.member_name || r.member}
                      </Text>
                    </View>
                    <View style={[s.statusBadge, { backgroundColor: meta.bg }]}>
                      <Text style={[s.statusText, { color: meta.text }]}>{r.status.toUpperCase()}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {items.length === 0 && <Empty text="No reservations in the queue." />}
      </View>

      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalContainer}>
            <Text style={s.modalTitle}>Confirm Loan Creation</Text>
            <Text style={s.modalMessage}>
              Create a loan for "{selectedReservation?.book_title}" to {selectedReservation?.member_name}?
            </Text>
            <View style={s.modalButtons}>
              <TouchableOpacity 
                style={[s.modalButton, s.modalCancelButton]} 
                onPress={() => {
                  setModalVisible(false);
                  setSelectedReservation(null);
                }}
              >
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[s.modalButton, s.modalConfirmButton]} 
                onPress={handleFulfillReservation}
              >
                <Text style={s.modalConfirmText}>Create Loan</Text>
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
  inner: { paddingBottom: 48 },

  mainTitleWrap: { paddingHorizontal: 16, marginBottom: 16 },
  dateText: { fontSize: 13, fontWeight: '600', color: P.textMuted, marginTop: 2 },
  mainDashboardTitle: { fontSize: 28, fontWeight: '700', fontFamily: SERIF_FONT, color: P.espresso },

  sectionLabel: { color: P.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 12, marginBottom: 8, marginHorizontal: 16 },
  panel: { marginHorizontal: 16, backgroundColor: P.pureWhite, borderRadius: 6, borderWidth: 1, borderColor: P.parchmentDark, overflow: 'hidden', marginBottom: 12 },
  panelHeader: { backgroundColor: P.espresso, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  panelHeaderTxt: { color: P.parchment, fontSize: 13, fontWeight: '600', fontFamily: SERIF_FONT },

  actRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  actBorder: { borderBottomWidth: 1, borderBottomColor: P.brass },
  actIcon:   { width: 32, height: 32, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  actLabel:  { color: P.textMain, fontSize: 13, fontWeight: '600' },
  actMeta:   { color: P.textMuted, fontSize: 12, marginTop: 3 },

  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignSelf: 'center' },
  statusText:  { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: P.success,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    minWidth: 110,
    justifyContent: 'center',
  },
  approveBtnDisabled: {
    opacity: 0.5,
  },
  approveBtnText: {
    color: P.pureWhite,
    fontSize: 11,
    fontWeight: '600',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: P.pureWhite,
    borderRadius: 8,
    padding: 20,
    width: '80%',
    maxWidth: 300,
    borderWidth: 1,
    borderColor: P.parchmentDark,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: SERIF_FONT,
    color: P.espresso,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    color: P.textMain,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 4,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#F1EDE4',
    borderWidth: 1,
    borderColor: P.parchmentDark,
  },
  modalConfirmButton: {
    backgroundColor: P.success,
  },
  modalCancelText: {
    color: P.textMuted,
    fontWeight: '600',
  },
  modalConfirmText: {
    color: P.pureWhite,
    fontWeight: '600',
  },
});