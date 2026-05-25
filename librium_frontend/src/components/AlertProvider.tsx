import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert as RNAlert, Modal, StyleSheet, Text, View, Platform } from 'react-native';
import { Btn, C } from './UI';

type AlertButton = {
  text: string;
  onPress?: () => void;
  variant?: 'primary' | 'danger' | 'ghost' | 'success';
};

type AlertState = {
  visible: boolean;
  title: string;
  message: string;
  buttons: AlertButton[];
  cancelable: boolean;
};

type AlertContextValue = {
  showAlert: (title: string, message?: string, options?: { buttonText?: string; onClose?: () => void }) => void;
  showConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    options?: { confirmText?: string; cancelText?: string }
  ) => void;
};

const AlertContext = createContext<AlertContextValue>({
  showAlert: () => {},
  showConfirm: () => {},
});

export const useAlert = () => useContext(AlertContext);

export function AlertProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AlertState>({
    visible: false,
    title: '',
    message: '',
    buttons: [],
    cancelable: true,
  });

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  const showAlert = useCallback(
    (title: string, message = '', options?: { buttonText?: string; onClose?: () => void }) => {
      const onOk = () => {
        close();
        options?.onClose?.();
      };

      setState({
        visible: true,
        title,
        message,
        cancelable: true,
        buttons: [{ text: options?.buttonText ?? 'OK', onPress: onOk, variant: 'primary' }],
      });
    },
    [close]
  );

  const showConfirm = useCallback(
    (
      title: string,
      message: string,
      onConfirm: () => void,
      options?: { confirmText?: string; cancelText?: string }
    ) => {
      const handleConfirm = () => {
        close();
        onConfirm();
      };
      const handleCancel = () => {
        close();
      };

      setState({
        visible: true,
        title,
        message,
        cancelable: true,
        buttons: [
          { text: options?.cancelText ?? 'Cancel', onPress: handleCancel, variant: 'ghost' },
          { text: options?.confirmText ?? 'OK', onPress: handleConfirm, variant: 'danger' },
        ],
      });
    },
    [close]
  );

  useEffect(() => {
    const originalAlert = RNAlert.alert;

    RNAlert.alert = (
      title: string,
      message?: string,
      buttons?: Array<{ text?: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>,
      options?: { cancelable?: boolean }
    ) => {
      const normalizedTitle = typeof title === 'string' ? title : '';
      const normalizedMessage = typeof message === 'string' ? message : '';
      const buttonDefs = Array.isArray(buttons) ? buttons : undefined;
      const cancelable = options?.cancelable ?? true;

      if (!buttonDefs || buttonDefs.length === 0) {
        setState({
          visible: true,
          title: normalizedTitle,
          message: normalizedMessage,
          cancelable,
          buttons: [
            {
              text: 'OK',
              onPress: () => {
                close();
              },
              variant: 'primary',
            },
          ],
        });
        return;
      }

      setState({
        visible: true,
        title: normalizedTitle,
        message: normalizedMessage,
        cancelable,
        buttons: buttonDefs.map((button) => ({
          text: button?.text ?? 'OK',
          variant: button?.style === 'destructive' ? 'danger' : button?.style === 'cancel' ? 'ghost' : 'primary',
          onPress: () => {
            close();
            if (typeof button?.onPress === 'function') button.onPress();
          },
        })),
      });
    };

    return () => {
      RNAlert.alert = originalAlert;
    };
  }, [close]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const originalWindowAlert = window.alert;
    window.alert = (message?: any) => {
      showAlert('Notice', String(message ?? ''));
    };

    return () => {
      window.alert = originalWindowAlert;
    };
  }, [showAlert]);

  const contextValue = useMemo(() => ({ showAlert, showConfirm }), [showAlert, showConfirm]);

  return (
    <AlertContext.Provider value={contextValue}>
      {children}
      <Modal visible={state.visible} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.backdrop}>
          <View style={styles.container}>
            <Text style={styles.title}>{state.title}</Text>
            {state.message ? <Text style={styles.message}>{state.message}</Text> : null}
            <View style={styles.actions}>
              {state.buttons.map((button, index) => (
                <Btn
                  key={index}
                  label={button.text}
                  onPress={button.onPress ?? close}
                  variant={button.variant ?? 'primary'}
                  style={state.buttons.length > 1 ? styles.buttonSplit : styles.buttonFull}
                />
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </AlertContext.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFDF9',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: C.text,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'System' }),
  },
  message: {
    fontSize: 14,
    color: C.text,
    lineHeight: 22,
    marginBottom: 20,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'System' }),
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 8,
  },
  buttonSplit: {
    flex: 1,
    marginHorizontal: 4,
  },
  buttonFull: {
    width: '100%',
  },
});
