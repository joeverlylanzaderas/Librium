// screens/auth/LoginScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ImageBackground,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { login, getMe, setToken, activateUser } from '../../services/api'; 
import { useAuth } from '../../context/AuthContext';
import { Btn } from '../../components/UI';
import { Fonts } from '../../constants/theme';
import { Feather } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

type Props = { navigation: any; route: any; };

export default function LoginScreen({ navigation, route }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [secureText, setSecureText] = useState(true);
  const [remember, setRemember] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null); // New visual UI error state

  // Cross-platform showAlert utility helper
  const showAlert = (title: string, msg: string) => {
    setErrorMsg(msg); // Set state so web displays it beautifully inline
    if (Platform.OS !== 'web') Alert.alert(title, msg);
  };

  // ── Listen for Incoming Email Activation deep links ───────────
  useEffect(() => {
    const { uid, token } = route?.params || {};
    if (!uid || !token) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        await activateUser(uid, token);
        if (!cancelled) showAlert('✅ Activated', 'Your account is verified. You can now log in.');
      } catch (e: any) {
        if (!cancelled) {
          const msg = e?.data?.detail ?? e?.data?.uid?.[0] ?? e?.data?.token?.[0] ?? 'Link is invalid or expired.';
          showAlert('Activation Failed', msg);
        }
      } finally {
        if (!cancelled) { setLoading(false); navigation.setParams({ uid: undefined, token: undefined }); }
      }
    })();
    return () => { cancelled = true; };
  }, [route?.params?.uid, route?.params?.token]);

  // ── Unified Login Request Logic ───────────────────────────────
  const handleLogin = async () => {
    if (!email.trim() || !password) return showAlert('Missing Fields', 'Please enter your email and password.');
    setLoading(true);
    setErrorMsg(null);
    try {
      const { access } = await login(email.trim().toLowerCase(), password);
      await setToken(access);
      const me = await getMe();
      signIn(access, me);
    } catch (e: any) {
      if (!e || typeof e.status === 'undefined') {
        return showAlert('Connection Error', 'Cannot connect to server. Check network status.');
      }
      const msg = 
        e.status === 401 ? 'Incorrect email or password.' :
        e.status === 403 ? 'Your account is not yet activated. Please check your email.' :
        e.status === 400 ? 'Please enter a valid email and password.' :
        e.status >= 500 ? 'Server runtime error. Please try again later.' :
        e?.data?.detail ?? 'Something went wrong. Please try again.';
      showAlert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ImageBackground source={require('../../../assets/login-bg.png')} style={s.bg} resizeMode="cover">
        <View style={s.overlay} />
        <ScrollView contentContainerStyle={s.scrollContainer} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={s.container}>
            <View style={s.headerGroup}>
              <Text style={s.logoText}>LIBRIUM</Text>
              <View style={s.logoLine} />
              <View style={s.quoteGroup}>
                <Text style={s.quoteText}>"Libraries store the energy that fuels the imagination."</Text>
                <Text style={s.quoteAuthor}>— Sidney Sheldon</Text>
              </View>
            </View>

            <View style={s.card}>
              <Text style={s.welcomeTitle}>WELCOME</Text>
              <View style={s.welcomeLine} />

              {/* Dynamic Error Text banner rendered contextually inside the card */}
              {errorMsg && (
                <View style={s.errorBanner}>
                  <Feather name="alert-circle" size={14} color="#A83232" style={{ marginRight: 6 }} />
                  <Text style={s.errorBannerText}>{errorMsg}</Text>
                </View>
              )}

              <View style={s.inputWrapper}>
                <Text style={s.inputLabel}>Email:</Text>
                <View style={s.fieldContainer}>
                  <Feather name="mail" size={15} color="#614E3C" style={s.fieldIcon} />
                  <TextInput
                    value={email} onChangeText={setEmail}
                    placeholder="name@institution.edu" placeholderTextColor="#A1927F"
                    autoCapitalize="none" keyboardType="email-address" style={s.customInput}
                  />
                </View>
              </View>

              <View style={s.inputWrapper}>
                <Text style={s.inputLabel}>Password:</Text>
                <View style={s.fieldContainer}>
                  <Feather name="lock" size={15} color="#614E3C" style={s.fieldIcon} />
                  <TextInput
                    value={password} onChangeText={setPassword}
                    placeholder="••••••••" placeholderTextColor="#A1927F"
                    secureTextEntry={secureText} style={s.customInput}
                  />
                  <TouchableOpacity style={s.eyeButton} onPress={() => setSecureText(!secureText)} activeOpacity={0.6}>
                    <Feather name={secureText ? "eye" : "eye-off"} size={15} color="#614E3C" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={s.utilitiesRow}>
                <TouchableOpacity style={s.checkboxContainer} activeOpacity={0.8} onPress={() => setRemember(!remember)}>
                  <View style={[s.checkbox, remember && s.checkboxChecked]}>
                    {remember && <Feather name="check" size={10} color="#FFF" />}
                  </View>
                  <Text style={s.utilityLabel}>Remember me</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.7}><Text style={s.utilityLabel}>Forgot Password</Text></TouchableOpacity>
              </View>

              <Btn label="SIGN IN" onPress={handleLogin} loading={loading} style={s.submitButton} textStyle={s.submitText} />

              <TouchableOpacity style={s.registerLink} activeOpacity={0.7} onPress={() => navigation.navigate('Register')}>
                <Text style={s.registerText}>Don't have an account? <Text style={s.registerBold}>Register</Text></Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </ImageBackground>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1E120C' },
  bg: { flex: 1, width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0, 0, 0, 0.15)' },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', paddingVertical: 40 },
  container: { alignItems: 'center', paddingHorizontal: 24 },
  headerGroup: { alignItems: 'center', marginBottom: 24 },
  logoText: { fontSize: width < 375 ? 56 : 64, fontFamily: Fonts.gloock, color: '#F4EFE0', fontWeight: '500', letterSpacing: 10, textAlign: 'center' },
  logoLine: { width: 36, height: 2, backgroundColor: '#C59568', marginTop: 4, marginBottom: 16 },
  quoteGroup: { maxWidth: 320, alignItems: 'center' },
  quoteText: { fontFamily: Fonts.baskerville, color: '#f3f1ed', fontSize: 13, textAlign: 'center', fontStyle: 'italic', lineHeight: 18, opacity: 0.85 },
  quoteAuthor: { fontFamily: Fonts.baskerville, color: '#f3c599', fontSize: 13, marginTop: 6, letterSpacing: 0.5 },
  card: { backgroundColor: '#F4EFE0', width: '100%', maxWidth: 390, borderRadius: 0, paddingHorizontal: 24, paddingTop: 42, paddingBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 15 }, shadowOpacity: 0.45, shadowRadius: 25, elevation: 12 },
  welcomeTitle: { fontSize: 20, fontFamily: Fonts.gloock, fontWeight: '600', color: '#281711', letterSpacing: 4, textAlign: 'center' },
  welcomeLine: { width: 40, height: 1, backgroundColor: '#DFD6C2', alignSelf: 'center', marginTop: 8, marginBottom: 20 },
  
  // Clean, editorial styling for the error banner
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FCE8E6', borderWidth: 1, borderColor: '#F5C2C2', padding: 10, marginBottom: 16, borderRadius: 0 },
  errorBannerText: { fontFamily: Fonts.sans, fontSize: 12, color: '#A83232', fontWeight: '500', flex: 1 },

  inputWrapper: { marginBottom: 16 },
  inputLabel: { fontFamily: Fonts.sans, fontSize: 14, color: '#513E2F', marginBottom: 6, fontWeight: '500' },
  fieldContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DFD6C2', height: 42, position: 'relative' },
  fieldIcon: { marginLeft: 12, marginRight: 2 },
  customInput: { flex: 1, backgroundColor: 'transparent', fontFamily: Fonts.sans, fontSize: 13, color: '#281711', paddingLeft: 8, paddingRight: 8, height: 42 },
  eyeButton: { position: 'absolute', right: 0, height: '100%', width: 40, justifyContent: 'center', alignItems: 'center' },
  utilitiesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, marginBottom: 24 },
  checkboxContainer: { flexDirection: 'row', alignItems: 'center' },
  checkbox: { width: 14, height: 14, borderWidth: 1, borderColor: '#8E7A66', marginRight: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  checkboxChecked: { backgroundColor: '#281711', borderColor: '#281711' },
  utilityLabel: { fontFamily: Fonts.sans, fontSize: 11, color: '#463527' },
  submitButton: { backgroundColor: '#281711', borderRadius: 0, height: 46, justifyContent: 'center', alignItems: 'center' },
  submitText: { fontFamily: Fonts.baskervilleBold, fontSize: 15, color: '#F4EFE0', letterSpacing: 2, fontWeight: '500' },
  registerLink: { alignItems: 'center', marginTop: 20 },
  registerText: { fontFamily: Fonts.sans, fontSize: 12, color: '#513E2F' },
  registerBold: { fontFamily: Fonts.baskervilleBold, color: '#281711', fontWeight: '700' },
});