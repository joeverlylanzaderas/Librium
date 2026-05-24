// screens/auth/RegisterScreen.tsx
import React, { useState } from 'react';
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
import { registerUser } from '../../services/api'; // Aligned with your exact function name
import { Btn } from '../../components/UI';
import { Fonts } from '../../constants/theme';
import { Feather } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

type Props = {
  navigation: any;
};

export default function RegisterScreen({ navigation }: Props) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [secureText, setSecureText] = useState(true);
  const [secureConfirmText, setSecureConfirmText] = useState(true);

  const handleRegister = async () => {
    if (!fullName || !username || !email || !password || !password2) {
      return Alert.alert('Error', 'Please fill in all fields.');
    }
    if (password !== password2) {
      return Alert.alert('Error', "Passwords don't match.");
    }

    setLoading(true);
    try {
      // Sending exact keys expected by your backend serializer
      await registerUser({
        email: email.trim(),
        username: username.trim().toLowerCase(),
        full_name: fullName.trim(),
        password: password,
        password2: password2,
      });

      Alert.alert(
        'Registration Success',
        'Your profile has been created! Since new accounts default to inactive, please wait for email verification or administrator approval before signing in.',
        [{ text: 'Go to Sign In', onPress: () => navigation.navigate('Login') }]
      );
    } catch (e: any) {
      // Standardizes error parser for both custom strings or Djoser multi-field array arrays
      let errorMsg = 'Could not complete registration profile.';
      if (e?.data) {
        errorMsg = Object.entries(e.data)
          .map(([key, val]) => {
            const displayVal = Array.isArray(val) ? val.join(', ') : val;
            return `${key.replace('_', ' ')}: ${displayVal}`;
          })
          .join('\n');
      }
      
      Alert.alert('Registration Failed', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ImageBackground
        source={require('../../../assets/login-bg.png')}
        style={s.bg}
        resizeMode="cover"
      >
        <View style={s.overlay} />

        <ScrollView
          contentContainerStyle={s.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.container}>
            
            {/* Editorial Header Section */}
            <View style={s.headerGroup}>
              <Text style={s.logoText}>LIBRIUM</Text>
              <View style={s.logoLine} />
              <View style={s.quoteGroup}>
                <Text style={s.quoteText}>
                  "Libraries store the energy that fuels the imagination."
                </Text>
                <Text style={s.quoteAuthor}>— Sidney Sheldon</Text>
              </View>
            </View>

            {/* Ivory Sharp Form Card */}
            <View style={s.card}>
              <Text style={s.welcomeTitle}>REGISTER</Text>
              <View style={s.welcomeLine} />

              {/* Full Name Input */}
              <View style={s.inputWrapper}>
                <Text style={s.inputLabel}>Full Name:</Text>
                <View style={s.fieldContainer}>
                  <Feather name="user" size={15} color="#614E3C" style={s.fieldIcon} />
                  <TextInput
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Jane Doe"
                    placeholderTextColor="#A1927F"
                    autoCapitalize="words"
                    style={s.customInput}
                  />
                </View>
              </View>

              {/* Username Input */}
              <View style={s.inputWrapper}>
                <Text style={s.inputLabel}>Username:</Text>
                <View style={s.fieldContainer}>
                  <Feather name="at-sign" size={15} color="#614E3C" style={s.fieldIcon} />
                  <TextInput
                    value={username}
                    onChangeText={setUsername}
                    placeholder="janedoe"
                    placeholderTextColor="#A1927F"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={s.customInput}
                  />
                </View>
              </View>

              {/* Email Input */}
              <View style={s.inputWrapper}>
                <Text style={s.inputLabel}>Email Address:</Text>
                <View style={s.fieldContainer}>
                  <Feather name="mail" size={15} color="#614E3C" style={s.fieldIcon} />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="name@institution.edu"
                    placeholderTextColor="#A1927F"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    style={s.customInput}
                  />
                </View>
              </View>

              {/* Password Input */}
              <View style={s.inputWrapper}>
                <Text style={s.inputLabel}>Password:</Text>
                <View style={s.fieldContainer}>
                  <Feather name="lock" size={15} color="#614E3C" style={s.fieldIcon} />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor="#A1927F"
                    secureTextEntry={secureText}
                    style={s.customInput}
                  />
                  <TouchableOpacity
                    style={s.eyeButton}
                    onPress={() => setSecureText(!secureText)}
                    activeOpacity={0.6}
                  >
                    <Feather name={secureText ? "eye" : "eye-off"} size={15} color="#614E3C" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Password Input (password2) */}
              <View style={s.inputWrapper2}>
                <Text style={s.inputLabel}>Confirm Password:</Text>
                <View style={s.fieldContainer}>
                  <Feather name="lock" size={15} color="#614E3C" style={s.fieldIcon} />
                  <TextInput
                    value={password2}
                    onChangeText={setPassword2}
                    placeholder="••••••••"
                    placeholderTextColor="#A1927F"
                    secureTextEntry={secureConfirmText}
                    style={s.customInput}
                  />
                  <TouchableOpacity
                    style={s.eyeButton}
                    onPress={() => setSecureConfirmText(!secureConfirmText)}
                    activeOpacity={0.6}
                  >
                    <Feather name={secureConfirmText ? "eye" : "eye-off"} size={15} color="#614E3C" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Submit CTA */}
              <Btn
                label="CREATE ACCOUNT"
                onPress={handleRegister}
                loading={loading}
                style={s.submitButton}
                textStyle={s.submitText}
              />

              {/* Alternate Navigation back to Sign In */}
              <TouchableOpacity 
                style={s.registerLink} 
                activeOpacity={0.7}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={s.registerText}>
                  Already have an account? <Text style={s.registerBold}>Sign In</Text>
                </Text>
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </ImageBackground>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1E120C',
  },
  bg: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  container: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  headerGroup: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoText: {
    fontSize: width < 375 ? 56 : 64,
    fontFamily: Fonts.gloock,
    color: '#F4EFE0',
    fontWeight: '500',
    letterSpacing: 10,
    textAlign: 'center',
  },
  logoLine: {
    width: 36,
    height: 2,
    backgroundColor: '#C59568',
    marginTop: 4,
    marginBottom: 16,
  },
  quoteGroup: {
    maxWidth: 320,
    alignItems: 'center',
  },
  quoteText: {
    fontFamily: Fonts.baskerville,
    color: '#f3f1ed',
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 18,
    opacity: 0.85,
  },
  quoteAuthor: {
    fontFamily: Fonts.baskerville,
    color: '#f3c599',
    fontSize: 13,
    marginTop: 6,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#F4EFE0',
    width: '100%',
    maxWidth: 390,
    borderRadius: 0,
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.45,
    shadowRadius: 25,
    elevation: 12,
  },
  welcomeTitle: {
    fontSize: 20,
    fontFamily: Fonts.gloock,
    fontWeight: '600',
    color: '#281711',
    letterSpacing: 4,
    textAlign: 'center',
  },
  welcomeLine: {
    width: 40,
    height: 1,
    backgroundColor: '#DFD6C2',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  inputWrapper: {
    marginBottom: 14,
  },
  inputWrapper2: {
    marginBottom: 24,
  },
  inputLabel: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: '#513E2F',
    marginBottom: 6,
    fontWeight: '500',
  },
  fieldContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DFD6C2',
    height: 42,
    position: 'relative',
  },
  fieldIcon: {
    marginLeft: 12,
    marginRight: 2,
  },
  customInput: {
    flex: 1,
    backgroundColor: 'transparent',
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#281711',
    paddingLeft: 8,
    paddingRight: 8,
    paddingVertical: 0,
    height: 42,
  },
  eyeButton: {
    position: 'absolute',
    right: 0,
    height: '100%',
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButton: {
    backgroundColor: '#281711',
    borderRadius: 0,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitText: {
    fontFamily: Fonts.baskervilleBold,
    fontSize: 15,
    color: '#F4EFE0',
    letterSpacing: 2,
    fontWeight: '500',
  },
  registerLink: {
    alignItems: 'center',
    marginTop: 20,
  },
  registerText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#513E2F',
  },
  registerBold: {
    fontFamily: Fonts.baskervilleBold,
    color: '#281711',
    fontWeight: '700',
  },
});