// src/screens/borrower/BorrowerProfileScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, TextInput, Modal,
} from 'react-native';
import { getMe, updateMe, changePassword } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { C, Row } from '../../components/UI';

type Profile = {
  phone_number: string;
  address:      string;
  bio:          string;
  birthday:     string | null;
  sex:          string | null;
  sex_display:  string | null;
  age:          number | null;
};

type Me = {
  id:          number;
  email:       string;
  username:    string;
  full_name:   string;
  role:        string;
  is_active:   boolean;
  date_joined: string;
  profile:     Profile | null;
};

export default function BorrowerProfileScreen() {
  const { signOut } = useAuth();
  const [me, setMe]                   = useState<Me | null>(null);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);

  // edit profile modal
  const [editModal, setEditModal]     = useState(false);
  const [fullName, setFullName]       = useState('');
  const [username, setUsername]       = useState('');
  const [phone, setPhone]             = useState('');
  const [address, setAddress]         = useState('');
  const [bio, setBio]                 = useState('');
  const [birthday, setBirthday]       = useState('');
  const [sex, setSex]                 = useState('');

  // change password modal
  const [pwModal, setPwModal]         = useState(false);
  const [oldPw, setOldPw]             = useState('');
  const [newPw, setNewPw]             = useState('');
  const [confirmPw, setConfirmPw]     = useState('');
  const [changingPw, setChangingPw]   = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getMe();
      setMe(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEditModal = () => {
    if (!me) return;
    setFullName(me.full_name ?? '');
    setUsername(me.username ?? '');
    setPhone(me.profile?.phone_number ?? '');
    setAddress(me.profile?.address ?? '');
    setBio(me.profile?.bio ?? '');
    setBirthday(me.profile?.birthday ?? '');
    setSex(me.profile?.sex ?? '');
    setEditModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMe({
        full_name: fullName,
        username,
        profile: {
          phone_number: phone,
          address,
          bio,
          birthday: birthday || null,
          sex:      sex || null,
        },
      });
      setEditModal(false);
      load();
    } catch (e: any) {
      const err = e?.data;
      const msg = typeof err === 'object'
        ? Object.values(err).flat().join('\n')
        : 'Could not save changes.';
      Alert.alert('Error', msg);
    } finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) {
      Alert.alert('Error', 'New passwords do not match.');
      return;
    }
    if (newPw.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters.');
      return;
    }
    setChangingPw(true);
    try {
      await changePassword({ old_password: oldPw, new_password: newPw, confirm_password: confirmPw });
      setPwModal(false);
      setOldPw(''); setNewPw(''); setConfirmPw('');
      Alert.alert('Success', 'Password changed successfully.');
    } catch (e: any) {
      const err = e?.data;
      const msg = typeof err === 'object'
        ? Object.values(err).flat().join('\n')
        : 'Could not change password.';
      Alert.alert('Error', msg);
    } finally { setChangingPw(false); }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.primary} />
      </View>
    );
  }

  if (!me) return null;

  const sexLabel = me.profile?.sex === 'M' ? 'Male' : me.profile?.sex === 'F' ? 'Female' : me.profile?.sex === 'O' ? 'Other' : '—';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Avatar / header */}
      <View style={s.header}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>
            {me.full_name?.charAt(0)?.toUpperCase() ?? '?'}
          </Text>
        </View>
        <Text style={s.name}>{me.full_name}</Text>
        <Text style={s.email}>{me.email}</Text>
        <View style={s.roleBadge}>
          <Text style={s.roleText}>Member</Text>
        </View>
      </View>

      {/* Personal info */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Personal Information</Text>
        <Row label="Username"    value={me.username} />
        <Row label="Email"       value={me.email} />
        <Row label="Phone"       value={me.profile?.phone_number || '—'} />
        <Row label="Birthday"    value={me.profile?.birthday || '—'} />
        <Row label="Age"         value={me.profile?.age ?? '—'} />
        <Row label="Sex"         value={sexLabel} />
        <Row label="Member since" value={me.date_joined?.split('T')[0]} />
      </View>

      {/* Address */}
      {me.profile?.address ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Address</Text>
          <Text style={s.bodyText}>{me.profile.address}</Text>
        </View>
      ) : null}

      {/* Bio */}
      {me.profile?.bio ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Bio</Text>
          <Text style={s.bodyText}>{me.profile.bio}</Text>
        </View>
      ) : null}

      {/* Actions */}
      <View style={{ paddingHorizontal: 16, gap: 10, marginTop: 8 }}>
        <TouchableOpacity style={s.actionBtn} onPress={openEditModal}>
          <Text style={s.actionTxt}>✏️  Edit Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionBtn, { backgroundColor: C.card }]} onPress={() => setPwModal(true)}>
          <Text style={[s.actionTxt, { color: C.sub }]}>🔒  Change Password</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionBtn, { backgroundColor: C.danger + '22', borderWidth: 1, borderColor: C.danger + '55' }]} onPress={handleSignOut}>
          <Text style={[s.actionTxt, { color: C.danger }]}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* ── Edit Profile Modal ───────────────────────────── */}
      <Modal visible={editModal} animationType="slide" onRequestClose={() => setEditModal(false)}>
        <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={s.modalTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={() => setEditModal(false)}>
              <Text style={{ color: C.muted, fontSize: 20 }}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.inputLabel}>Full Name</Text>
          <TextInput style={[s.input, { color: C.text }]} value={fullName} onChangeText={setFullName} placeholderTextColor={C.muted} />

          <Text style={s.inputLabel}>Username</Text>
          <TextInput style={[s.input, { color: C.text }]} value={username} onChangeText={setUsername} placeholderTextColor={C.muted} autoCapitalize="none" />

          <Text style={s.inputLabel}>Phone Number</Text>
          <TextInput style={[s.input, { color: C.text }]} value={phone} onChangeText={setPhone} placeholderTextColor={C.muted} keyboardType="phone-pad" />

          <Text style={s.inputLabel}>Birthday (YYYY-MM-DD)</Text>
          <TextInput style={[s.input, { color: C.text }]} value={birthday} onChangeText={setBirthday} placeholder="e.g. 2000-04-15" placeholderTextColor={C.muted} />

          <Text style={s.inputLabel}>Sex</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            {[{ label: 'Male', value: 'M' }, { label: 'Female', value: 'F' }, { label: 'Other', value: 'O' }].map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[s.sexBtn, sex === opt.value && s.sexBtnActive]}
                onPress={() => setSex(sex === opt.value ? '' : opt.value)}
              >
                <Text style={[s.sexTxt, sex === opt.value && s.sexTxtActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.inputLabel}>Address</Text>
          <TextInput
            style={[s.input, { minHeight: 70, textAlignVertical: 'top', color: C.text }]}
            value={address}
            onChangeText={setAddress}
            multiline
            placeholderTextColor={C.muted}
          />

          <Text style={s.inputLabel}>Bio</Text>
          <TextInput
            style={[s.input, { minHeight: 80, textAlignVertical: 'top', color: C.text }]}
            value={bio}
            onChangeText={setBio}
            multiline
            placeholder="A little about yourself..."
            placeholderTextColor={C.muted}
          />

          <TouchableOpacity
            style={[s.actionBtn, { marginTop: 10 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.actionTxt}>Save Changes</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </Modal>

      {/* ── Change Password Modal ────────────────────────── */}
      <Modal visible={pwModal} animationType="slide" transparent onRequestClose={() => setPwModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={s.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setPwModal(false)}>
                <Text style={{ color: C.muted, fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.inputLabel}>Current Password</Text>
            <TextInput style={[s.input, { color: C.text }]} value={oldPw} onChangeText={setOldPw} secureTextEntry placeholderTextColor={C.muted} placeholder="••••••••" />

            <Text style={s.inputLabel}>New Password</Text>
            <TextInput style={[s.input, { color: C.text }]} value={newPw} onChangeText={setNewPw} secureTextEntry placeholderTextColor={C.muted} placeholder="••••••••" />

            <Text style={s.inputLabel}>Confirm New Password</Text>
            <TextInput style={[s.input, { color: C.text }]} value={confirmPw} onChangeText={setConfirmPw} secureTextEntry placeholderTextColor={C.muted} placeholder="••••••••" />

            <TouchableOpacity
              style={[s.actionBtn, { marginTop: 8 }]}
              onPress={handleChangePassword}
              disabled={changingPw}
            >
              {changingPw
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.actionTxt}>Change Password</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  header:        { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  avatar:        { width: 72, height: 72, borderRadius: 36, backgroundColor: C.primary + '33', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarText:    { color: C.primary, fontSize: 28, fontWeight: '800' },
  name:          { color: C.text, fontSize: 18, fontWeight: '800', marginBottom: 2 },
  email:         { color: C.sub, fontSize: 13, marginBottom: 8 },
  roleBadge:     { backgroundColor: C.primary + '22', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: C.primary + '55' },
  roleText:      { color: C.primary, fontSize: 12, fontWeight: '700' },
  section:       { marginHorizontal: 16, marginTop: 16, backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8 },
  sectionTitle:  { color: C.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', paddingTop: 10, marginBottom: 4 },
  bodyText:      { color: C.sub, fontSize: 13, lineHeight: 20, paddingVertical: 6 },
  actionBtn:     { backgroundColor: C.primary, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  actionTxt:     { color: '#fff', fontWeight: '700', fontSize: 14 },
  inputLabel:    { color: C.sub, fontSize: 12, marginBottom: 5, fontWeight: '500' },
  input:         { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 14 },
  sexBtn:        { flex: 1, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  sexBtnActive:  { backgroundColor: C.primary, borderColor: C.primary },
  sexTxt:        { color: C.sub, fontSize: 13, fontWeight: '600' },
  sexTxtActive:  { color: '#fff' },
  modalOverlay:  { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
  modalSheet:    { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle:    { color: C.text, fontSize: 17, fontWeight: '800' },
});