/**
 * DeleteAccountSheet - second-step confirmation for account deletion.
 *
 * Apple 5.1.1(v) / Play require in-app account deletion; this adds a typed
 * confirmation on top of the initial alert. The user must retype the email on
 * their account before the destructive action unlocks, which prevents an
 * accidental one-tap wipe.
 *
 * Built with React Native's stock `Modal` to match LocaleSheet/ThemeSheet.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';
import FormInput from './FormInput';
import { InModalToast } from './toastShared';

const DeleteAccountSheet = ({ visible, onClose, onConfirm, email, submitting }) => {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (!visible) setTyped('');
  }, [visible]);

  const expected = (email || '').trim().toLowerCase();
  const matches = expected.length > 0 && typed.trim().toLowerCase() === expected;
  const locked = !matches || submitting;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.title}>{t('security.deleteConfirmTitle')}</Text>
          <Text style={styles.subtitle}>{t('security.deleteConfirmBody')}</Text>

          <FormInput
            label={t('security.deleteConfirmEmailLabel')}
            icon="mail-outline"
            value={typed}
            onChangeText={setTyped}
            placeholder={email || ''}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
          />

          <TouchableOpacity
            onPress={onConfirm}
            disabled={locked}
            activeOpacity={locked ? 1 : 0.8}
            accessibilityRole="button"
            accessibilityLabel={t('security.deleteAccountCta')}
            accessibilityState={{ disabled: locked }}
            style={[styles.destructive, locked && styles.destructiveDisabled]}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.destructiveText}>
                {t('security.deleteAccountCta')}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onClose}
            style={styles.dismiss}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          >
            <Text style={styles.dismissText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
        <InModalToast />
      </View>
    </Modal>
  );
};

const makeStyles = (tokens) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: tokens.bg.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 22,
      paddingTop: 12,
      paddingBottom: 28,
    },
    grabber: {
      width: 44,
      height: 5,
      backgroundColor: tokens.border.default,
      borderRadius: 3,
      alignSelf: 'center',
      marginBottom: 18,
    },
    title: {
      fontSize: 19,
      fontWeight: '900',
      color: tokens.status.error,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 13,
      lineHeight: 19,
      color: tokens.text.muted,
      marginTop: 6,
      marginBottom: 20,
    },
    destructive: {
      backgroundColor: tokens.status.error,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 54,
    },
    destructiveDisabled: {
      backgroundColor: tokens.bg.surfaceStrong,
    },
    destructiveText: {
      fontSize: 15,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    dismiss: {
      marginTop: 8,
      paddingVertical: 12,
      alignItems: 'center',
    },
    dismissText: {
      fontSize: 14,
      fontWeight: '700',
      color: tokens.text.muted,
    },
  });

export default DeleteAccountSheet;
