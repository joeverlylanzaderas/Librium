// src/components/UI.tsx
import React, { ReactNode } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, StyleSheet, TextInputProps, ViewStyle, TextStyle,
  StyleProp,
} from 'react-native';

export const C = {
  bg:      '#F5F0E8', 
  surface: '#FFFDF9',
  card:    '#FFFDF9',
  border:  '#E8DCC8', 
  primary: '#8B6914', 
  success: '#2E7D32',
  warning: '#DAA520',
  danger:  '#A0522D', 
  muted:   '#A68A64', 
  text:    '#4A3728',
  sub:     '#8B7355', 
};

// ── Button ────────────────────────────────────────────────────
type BtnProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'success' | 'danger' | 'warning' | 'ghost';
  loading?: boolean;
  textStyle?: TextStyle;
  style?: StyleProp<ViewStyle>;
};

export const Btn = ({
  label, onPress, variant = 'primary', loading, style, textStyle,
}: BtnProps) => {
  const bg: Record<string, string> = {
    primary: C.primary,
    success: C.success,
    danger:  C.danger,
    warning: C.warning,
    ghost:   'transparent',
  };

  const getTextColor = () => {
    if (variant === 'ghost') return C.sub;
    return '#FFFFFF';
  };

  return (
    <TouchableOpacity
      style={[
        s.btn,
        { backgroundColor: bg[variant] },
        variant === 'ghost' && { borderWidth: 1, borderColor: C.border },
        style,
      ]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'ghost' ? C.primary : '#fff'} size="small" />
      ) : (
        <Text style={[s.btnTxt, { color: getTextColor() }, textStyle]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
};

// ── Input ─────────────────────────────────────────────────────
type InputProps = TextInputProps & { label?: string; containerStyle?: ViewStyle };

export const Input = ({ label, containerStyle, ...props }: InputProps) => (
  <View style={[{ marginBottom: 14 }, containerStyle]}>
    {label && <Text style={s.label}>{label}</Text>}
    <TextInput
      style={s.input}
      placeholderTextColor={C.muted}
      {...props}
    />
  </View>
);

// ── Card ──────────────────────────────────────────────────────
export const Card = ({ children, style }: { children: ReactNode; style?: ViewStyle }) => (
  <View style={[s.card, style]}>{children}</View>
);

// ── Section Header ────────────────────────────────────────────
export const SectionHeader = ({
  title, action, onAction, titleColor,
}: { title: string; action?: string; onAction?: () => void; titleColor?: string }) => (
  <View style={s.secHeader}>
    <Text style={[s.secTitle, titleColor ? { color: titleColor } : undefined]}>{title}</Text>
    {action && (
      <TouchableOpacity onPress={onAction}>
        <Text style={{ color: C.primary, fontSize: 13, fontWeight: '600' }}>{action}</Text>
      </TouchableOpacity>
    )}
  </View>
);

// ── Badge ─────────────────────────────────────────────────────
export const Badge = ({ label, color = C.muted }: { label: string; color?: string }) => (
  <View style={[s.badge, { backgroundColor: color + '15', borderColor: color + '40' }]}>
    <Text style={[s.badgeTxt, { color }]}>{label}</Text>
  </View>
);

// ── Empty ─────────────────────────────────────────────────────
export const Empty = ({ text = 'Nothing here yet.' }: { text?: string }) => (
  <View style={s.center}>
    <Text style={{ color: C.muted, fontSize: 14, fontStyle: 'italic', fontFamily: 'Georgia' }}>{text}</Text>
  </View>
);

// ── Loading ───────────────────────────────────────────────────
export const Loading = ({ transparent = false }: { transparent?: boolean }) => (
  <View style={[s.center, { flex: 1, backgroundColor: transparent ? 'transparent' : C.bg }]}>
    <ActivityIndicator color={C.primary} size="large" />
  </View>
);

// ── Row ───────────────────────────────────────────────────────
export const Row = ({ label, value }: { label: string; value?: any }) => (
  <View style={s.row}>
    <Text style={s.rowLabel}>{label}</Text>
    <Text style={s.rowValue}>{value ?? '—'}</Text>
  </View>
);

const s = StyleSheet.create({
  btn:       { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 4, alignItems: 'center', marginVertical: 4 },
  btnTxt:    { fontWeight: '600', fontSize: 14 },
  label:     { color: C.sub, fontSize: 12, marginBottom: 5, fontWeight: '600' },
  input:     { backgroundColor: C.surface, color: C.text, borderWidth: 1, borderColor: C.border, borderRadius: 4, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: 'Georgia' },
  card:      { backgroundColor: C.surface, borderRadius: 4, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  secHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 6 },
  secTitle:  { color: C.text, fontSize: 16, fontWeight: '700', fontFamily: 'Georgia' },
  badge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 0, borderWidth: 1, alignSelf: 'flex-start' },
  badgeTxt:  { fontSize: 11, fontWeight: '600' },
  center:    { alignItems: 'center', justifyContent: 'center', paddingVertical: 30 },
  row:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  rowLabel:  { color: C.sub, fontSize: 13 },
  rowValue:  { color: C.text, fontSize: 13, fontWeight: '500', maxWidth: '60%', textAlign: 'right', fontFamily: 'Georgia' },
});