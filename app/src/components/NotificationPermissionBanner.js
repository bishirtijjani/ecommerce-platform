/**
 * Persistent "notifications are off" nudge.
 *
 * The OS only shows its permission dialog a limited number of times (once on
 * iOS, a couple of times on Android). After that the app cannot re-prompt, so
 * a user who dismissed it silently stops receiving anything. This banner stays
 * visible until notifications are on, and its button either request the
 * permission again (when the system still allows it) or opens the app's
 * Settings page.
 */
import React, { useCallback, useEffect, useState } from "react";
import { AppState, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getPushPermissionState, openNotificationSettings } from "../services/notifications";
import { ensurePushPermission } from "../services/pushPermission";
import { useTheme } from "../theme";

export default function NotificationPermissionBanner() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useSelector((s) => s.auth?.isAuthenticated);
  const [permission, setPermission] = useState({ status: "granted", canAskAgain: true });
  const [dismissed, setDismissed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setPermission(await getPushPermissionState());
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (isAuthenticated) refresh();
  }, [isAuthenticated, refresh]);

  // Re-read after the user comes back from the OS settings page.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  if (!isAuthenticated || dismissed) return null;
  if (permission.status === "granted" || permission.status === "unsupported") return null;
  // A browser-blocked permission cannot be fixed from a settings page we can open.
  if (Platform.OS === "web" && !permission.canAskAgain) return null;

  const onEnable = async () => {
    if (permission.canAskAgain) {
      await ensurePushPermission("notifications");
      await refresh();
      return;
    }
    await openNotificationSettings();
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 76 }]}>
      <View
        style={[
          styles.banner,
          { backgroundColor: tokens.bg.surface, borderColor: tokens.border.default },
        ]}
      >
        <Ionicons name="notifications-off-outline" size={22} color={tokens.text.primary} />
        <View style={styles.copy}>
          <Text style={[styles.title, { color: tokens.text.primary }]}>Notifications are off</Text>
          <Text style={[styles.body, { color: tokens.text.muted }]}>
            You&apos;ll miss new requests and order updates.
          </Text>
        </View>
        <TouchableOpacity
          onPress={onEnable}
          accessibilityRole="button"
          style={[styles.action, { backgroundColor: tokens.brand.default }]}
        >
          <Text style={[styles.actionText, { color: tokens.text.onBrand }]}>Turn on</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setDismissed(true)}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={18} color={tokens.text.muted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 12, right: 12, zIndex: 20, elevation: 20 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  copy: { flex: 1 },
  title: { fontSize: 14, fontWeight: "800" },
  body: { fontSize: 12, marginTop: 2 },
  action: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  actionText: { fontSize: 13, fontWeight: "800" },
});
