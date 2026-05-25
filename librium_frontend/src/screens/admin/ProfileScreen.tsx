// src/screens/admin/ProfileScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  Platform,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getMe, updateMe, changePassword } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const SERIF_FONT = Platform.select({ ios: 'Georgia', android: 'serif' });
const P = {
  espresso:      '#1F150C',
  mahogany:      '#412D15',
  parchment:     '#FBF5DD',
  parchmentDark: '#EFE9CE',
  brass:         '#FFC85C',
  amber:         '#F69D39',
  textMain:      '#2D1F10',
  textMuted:     '#A89A84', // Boosted contrast ratio for placeholder items
};

type Profile = {
  profile_picture: string | null;
  phone_number:    string;
  address:         string;
  bio:             string;
  birthday:        string | null;
  sex:             string | null;
  sex_display:     string | null;
  age:             number | null;
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

export default function ProfileScreen() {
  const { signOut, refreshUser  } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit Profile Modal Fields
  const [editModal, setEditModal] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [bio, setBio] = useState('');
  const [birthday, setBirthday] = useState('');
  const [sex, setSex] = useState('');

  // Change Password Modal Fields
  const [pwModal, setPwModal] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [changingPw, setChangingPw] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const loadProfileData = useCallback(async () => {
    try {
      const data = await getMe();
      setMe(data);
    } catch (e) {
      console.error("Failed fetching admin profile profile details:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library to change your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const fileInfo = {
      uri: asset.uri,
      type: asset.mimeType ?? 'image/jpeg',
      name: asset.fileName ?? `avatar_${Date.now()}.jpg`,
    };

    setUploadingAvatar(true);
    try {
      const formData = new FormData();

      if (Platform.OS === 'web') {
        const responseBlob = await fetch(fileInfo.uri);
        const fileBlob = await responseBlob.blob();
        formData.append('file', fileBlob, fileInfo.name);
      } else {
        formData.append('file', {
          uri: fileInfo.uri,
          type: fileInfo.type,
          name: fileInfo.name,
        } as any);
      }

      formData.append('upload_preset', 'librium_covers');
      formData.append('cloud_name', 'dz5b4xsjy');

      const response = await fetch('https://api.cloudinary.com/v1_1/dz5b4xsjy/image/upload', {
        method: 'POST',
        body: formData,
        headers: { 'Accept': 'application/json' },
      });

      const responseText = await response.text();
      if (!response.ok) throw new Error(`Upload failed (${response.status})`);

      const cloudData = JSON.parse(responseText);
      if (!cloudData.secure_url) throw new Error('No URL returned from Cloudinary');

      await updateMe({ profile: { profile_picture: cloudData.secure_url } });
      await loadProfileData();
      await refreshUser({ profile_picture: cloudData.secure_url }); 
    } catch (e: any) {
      console.error('Avatar upload error:', e);
      Alert.alert('Upload Failed', 'Could not update profile picture. Please try again.');
    } finally {
      setUploadingAvatar(false);
    }
  };

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

  const handleSaveProfile = async () => {
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
          sex: sex || null,
        },
      });
      setEditModal(false);
      loadProfileData();
    } catch (e: any) {
      const err = e?.data;
      const msg = typeof err === 'object'
        ? Object.values(err).flat().join('\n')
        : 'Could not save modifications.';
      Alert.alert('Update Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) {
      Alert.alert('Validation Error', 'New passwords do not match.');
      return;
    }
    if (newPw.length < 8) {
      Alert.alert('Validation Error', 'Password must be at least 8 characters.');
      return;
    }
    setChangingPw(true);
    try {
      await changePassword({ old_password: oldPw, new_password: newPw, confirm_password: confirmPw });
      setPwModal(false);
      setOldPw(''); 
      setNewPw(''); 
      setConfirmPw('');
      Alert.alert('Success', 'Security password successfully modified.');
    } catch (e: any) {
      const err = e?.data;
      const msg = typeof err === 'object'
        ? Object.values(err).flat().join('\n')
        : 'Could not update security credentials.';
      Alert.alert('Security Error', msg);
    } finally {
      setChangingPw(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('End Session', 'Are you sure you want to log out of Librium?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: signOut },
    ]);
  };

  if (loading || !me) {
    return (
      <View style={s.centerContainer}>
        <ActivityIndicator size="large" color={P.espresso} />
      </View>
    );
  }

  const sexLabel = me.profile?.sex === 'M' ? 'Male' : me.profile?.sex === 'F' ? 'Female' : me.profile?.sex === 'O' ? 'Other' : '—';

  return (
      <ScrollView style={s.container} contentContainerStyle={s.scrollContent}>
        
        {/* Profile Header Block */}
        <View style={s.headerCard}>
          <TouchableOpacity style={s.avatarWrapper} onPress={handlePickAvatar} disabled={uploadingAvatar}>
            {me.profile?.profile_picture ? (
              <Image source={{ uri: me.profile.profile_picture }} style={s.avatarImage} />
            ) : (
              <View style={s.avatarContainer}>
                <Text style={s.avatarText}>
                  {me.full_name?.charAt(0)?.toUpperCase() ?? 'A'}
                </Text>
              </View>
            )}
            <View style={s.avatarEditBadge}>
              {uploadingAvatar
                ? <ActivityIndicator size="small" color={P.espresso} />
                : <Ionicons name="camera" size={14} color={P.espresso} />
              }
            </View>
          </TouchableOpacity>
          <Text style={s.adminName}>{me.full_name}</Text>
          <Text style={s.adminEmail}>{me.email}</Text>
          <View style={s.roleBadge}>
            <Text style={s.roleText}>ADMINISTRATOR</Text>
          </View>
        </View>

        {/* Account Details */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Identity Registry</Text>
          <View style={s.infoRow}><Text style={s.infoLabel}>Username</Text><Text style={s.infoValue}>{me.username}</Text></View>
          <View style={s.infoRow}><Text style={s.infoLabel}>Email</Text><Text style={s.infoValue}>{me.email}</Text></View>
          <View style={s.infoRow}><Text style={s.infoLabel}>Contact Line</Text><Text style={s.infoValue}>{me.profile?.phone_number || '—'}</Text></View>
          <View style={s.infoRow}><Text style={s.infoLabel}>Date of Birth</Text><Text style={s.infoValue}>{me.profile?.birthday || '—'}</Text></View>
          <View style={s.infoRow}><Text style={s.infoLabel}>Age Status</Text><Text style={s.infoValue}>{me.profile?.age ?? '—'}</Text></View>
          <View style={s.infoRow}><Text style={s.infoLabel}>Biological Sex</Text><Text style={s.infoValue}>{sexLabel}</Text></View>
          <View style={s.infoRow}><Text style={s.infoLabel}>Enrolled Since</Text><Text style={s.infoValue}>{me.date_joined?.split('T')[0]}</Text></View>
        </View>

        {/* Address Registry */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Physical Address</Text>
          <Text style={s.bodyText}>{me.profile?.address || 'No address provided.'}</Text>
        </View>

        {/* Bio / Meta Notes */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Biography Note</Text>
          <Text style={s.bodyText}>{me.profile?.bio || 'No status description configured.'}</Text>
        </View>

        {/* Control Actions Base */}
        <View style={s.actionLayout}>
          <TouchableOpacity style={s.btnPrimary} onPress={openEditModal}>
            <Ionicons name="create-outline" size={18} color={P.espresso} />
            <Text style={s.btnPrimaryTxt}>Modify Registry Details</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.btnSecondary} onPress={() => setPwModal(true)}>
            <Ionicons name="lock-closed-outline" size={18} color={P.mahogany} />
            <Text style={s.btnPrimaryTxt}>Update Security Password</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.btnDanger} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={18} color="#FF6B6B" />
            <Text style={s.btnDangerTxt}>Terminate Active Session</Text>
          </TouchableOpacity>
        </View>

        {/* ── UPDATE PROFILE MODAL ── */}
        <Modal visible={editModal} animationType="fade" transparent={true} onRequestClose={() => setEditModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
            <View style={s.modalSheet}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Modify Admin Profile</Text>
                <TouchableOpacity onPress={() => setEditModal(false)}>
                  <Ionicons name="close" size={24} color={P.parchment} />
                </TouchableOpacity>
              </View>
              
              <ScrollView showsVerticalScrollIndicator={true} contentContainerStyle={s.modalSheetContent}>
                <Text style={s.inputLabel}>Full Name</Text>
                <TextInput style={s.input} value={fullName} onChangeText={setFullName} placeholderTextColor={P.textMuted} />

                <Text style={s.inputLabel}>System Username</Text>
                <TextInput style={s.input} value={username} onChangeText={setUsername} autoCapitalize="none" placeholderTextColor={P.textMuted} />

                <Text style={s.inputLabel}>Contact Phone</Text>
                <TextInput style={s.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor={P.textMuted} />

                <Text style={s.inputLabel}>Birthday (YYYY-MM-DD)</Text>
                <TextInput style={s.input} value={birthday} onChangeText={setBirthday} placeholder="e.g. 1995-12-01" placeholderTextColor={P.textMuted} />

                <Text style={s.inputLabel}>Biological Sex Alignment</Text>
                <View style={s.sexButtonGroup}>
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

                <Text style={s.inputLabel}>Physical Domicile Address</Text>
                <TextInput style={[s.input, s.textArea]} value={address} onChangeText={setAddress} multiline numberOfLines={3} placeholderTextColor={P.textMuted} />

                <Text style={s.inputLabel}>Professional Status Biography</Text>
                <TextInput style={[s.input, s.textArea]} value={bio} onChangeText={setBio} multiline numberOfLines={3} placeholderTextColor={P.textMuted} />

                <TouchableOpacity style={s.modalSubmitBtn} onPress={handleSaveProfile} disabled={saving}>
                  {saving ? <ActivityIndicator color={P.espresso} /> : <Text style={s.modalSubmitBtnTxt}>Commit Profile Updates</Text>}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* ── UPDATE PASSWORD MODAL (FIXED SCROLL & HEIGHT ISSUES) ── */}
        <Modal visible={pwModal} animationType="fade" transparent={true} onRequestClose={() => setPwModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
            <View style={[s.modalSheet, { maxWidth: 500 }]}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Modify Credentials</Text>
                <TouchableOpacity onPress={() => setPwModal(false)}>
                  <Ionicons name="close" size={24} color={P.parchment} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={true} contentContainerStyle={s.modalSheetContent}>
                <Text style={s.inputLabel}>Current Password Instance</Text>
                <TextInput style={s.input} value={oldPw} onChangeText={setOldPw} secureTextEntry placeholder="••••••••" placeholderTextColor={P.textMuted} />

                <Text style={s.inputLabel}>Target New Password</Text>
                <TextInput style={s.input} value={newPw} onChangeText={setNewPw} secureTextEntry placeholder="••••••••" placeholderTextColor={P.textMuted} />

                <Text style={s.inputLabel}>Re-verify Target Password</Text>
                <TextInput style={s.input} value={confirmPw} onChangeText={setConfirmPw} secureTextEntry placeholder="••••••••" placeholderTextColor={P.textMuted} />

                <TouchableOpacity style={s.modalSubmitBtn} onPress={handleChangePassword} disabled={changingPw}>
                  {changingPw ? <ActivityIndicator color={P.espresso} /> : <Text style={s.modalSubmitBtnTxt}>Update Security Access</Text>}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

      </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.parchment },
  scrollContent: { padding: 24, gap: 20, maxWidth: 900, width: '100%', alignSelf: 'center' },
  centerContainer: { flex: 1, height: '100%', minHeight: 400, alignItems: 'center', justifyContent: 'center' },
  
  headerCard: {
    backgroundColor: P.espresso,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 32,
    borderWidth: 1,
    borderColor: P.mahogany,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 14,
  },
  avatarImage: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: P.brass,
  },
  avatarContainer: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: P.brass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: P.brass,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: P.espresso,
  },
  avatarText: { color: P.espresso, fontSize: 34, fontWeight: '800', fontFamily: SERIF_FONT },
  adminName: { color: P.parchment, fontSize: 22, fontWeight: '700', fontFamily: SERIF_FONT, marginBottom: 4 },
  adminEmail: { color: P.parchmentDark, fontSize: 14, marginBottom: 14, opacity: 0.8 },
  roleBadge: {
    backgroundColor: 'rgba(255, 200, 92, 0.15)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: P.brass,
  },
  roleText: { color: P.brass, fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  section: {
    backgroundColor: P.espresso,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: P.mahogany,
    padding: 20,
  },
  sectionTitle: {
    color: P.brass,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    paddingBottom: 8,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  infoLabel: { color: P.parchmentDark, fontSize: 14, opacity: 0.6 },
  infoValue: { color: P.parchment, fontSize: 14, fontWeight: '600' },
  bodyText: { color: P.parchmentDark, fontSize: 14, lineHeight: 22 },

  actionLayout: { gap: 12, marginTop: 4 },
  btnPrimary: {
    backgroundColor: P.brass,
    borderRadius: 8,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnPrimaryTxt: { color: P.espresso, fontWeight: '700', fontSize: 14 },
  btnSecondary: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: P.mahogany,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnSecondaryTxt: { color: P.parchmentDark, fontWeight: '600', fontSize: 14 },
  btnDanger: {
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.2)',
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnDangerTxt: { color: '#FF6B6B', fontWeight: '700', fontSize: 14 },

  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.6)', 
    justifyContent: 'center', 
    padding: 16,
  },
  modalSheet: {
    backgroundColor: P.espresso,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: P.mahogany,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    maxHeight: '85%', // Prevent layout from running completely off screen
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    backgroundColor: P.espresso,
  },
  modalSheetContent: { 
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  modalTitle: { color: P.parchment, fontSize: 18, fontWeight: '700', fontFamily: SERIF_FONT },
  inputLabel: { color: P.brass, fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: 'rgba(0,0,0,0.25)', // Deepened drop background tint
    borderWidth: 1,
    borderColor: '#543D20', // Higher contrast border lines
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#FFFFFF', // High-contrast crisp input text
    marginBottom: 16,
  },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  sexButtonGroup: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  sexBtn: { flex: 1, paddingVertical: 10, borderRadius: 6, borderWidth: 1, borderColor: P.mahogany, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.1)' },
  sexBtnActive: { backgroundColor: P.brass, borderColor: P.brass },
  sexTxt: { color: P.parchmentDark, fontSize: 13, fontWeight: '600' },
  sexTxtActive: { color: P.espresso, fontWeight: '700' },
  modalSubmitBtn: {
    backgroundColor: P.brass,
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  modalSubmitBtnTxt: { color: P.espresso, fontWeight: '700', fontSize: 14 },
});