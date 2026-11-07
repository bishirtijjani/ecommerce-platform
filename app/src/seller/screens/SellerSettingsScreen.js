import React, { useEffect, useState } from "react";
import { RefreshControl, ScrollView, Switch, Text, View, TextInput, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { useTheme } from "../../theme";
import { useVendorProfile, useToggleShopStatus } from "../hooks/useSeller";
import { fetchNotificationPreferences, updateNotificationPreferences, fetchProfile, updateProfile } from "../../store/slices/profileSlice";
import api from "../../services/api";
import { Card, ListRow, LoadingState, PageHeader, SectionLabel } from "../components/ui";

// Only these keys are user-facing booleans. The API also returns id/userId/
// timestamps, which must not be rendered as switches.
const NOTIFICATION_ROWS = [
  { key: "pushEnabled", label: "Push notifications", sub: "Order and message alerts on this device" },
  { key: "orderUpdates", label: "Order updates", sub: "New orders, cancellations and status changes" },
  { key: "emailEnabled", label: "Email notifications", sub: "Important account and shop emails" },
  { key: "promotions", label: "Promotions", sub: "Marketing tips and platform offers" },
];

export default function SellerSettingsScreen() {
  const { tokens } = useTheme();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { data: vendor, isLoading: vendorLoading, refetch: refetchVendor } = useVendorProfile();
  const toggle = useToggleShopStatus();
  const { notificationPreferences, isUpdating, profile } = useSelector((s) => s.profile);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [sessions, setSessions] = useState([]);
  const [savingAccount, setSavingAccount] = useState(false);

  useEffect(() => {
    dispatch(fetchProfile());
  }, [dispatch]);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName || "");
      setLastName(profile.lastName || "");
      setPhone(profile.phone || "");
    }
  }, [profile]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/auth/sessions");
        const data = res?.data || res;
        setSessions(Array.isArray(data) ? data : data?.data || []);
      } catch (e) {}
    })();
  }, []);

  useEffect(() => {
    dispatch(fetchNotificationPreferences());
  }, [dispatch]);

  const updatePref = (key, value) => {
    dispatch(updateNotificationPreferences({ [key]: value }));
  };

  const saveAccount = async () => {
    setSavingAccount(true);
    try {
      await dispatch(updateProfile({ firstName, lastName, phone })).unwrap();
      Alert.alert("Saved", "Account updated");
    } catch (e) {
      Alert.alert("Error", e?.message || "Could not update account");
    } finally {
      setSavingAccount(false);
    }
  };

  const revokeSession = async (id) => {
    try {
      await api.delete(`/auth/sessions/${id}`);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      Alert.alert("Error", e?.message || "Could not sign out session");
    }
  };

  const revokeOthers = async () => {
    try {
      await api.delete("/auth/sessions/others");
      const res = await api.get("/auth/sessions");
      const data = res?.data || res;
      setSessions(Array.isArray(data) ? data : data?.data || []);
    } catch (e) {
      Alert.alert("Error", e?.message || "Could not sign out other sessions");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <ScrollView
        style={{ width: "100%", maxWidth: 960, alignSelf: "center" }}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={vendorLoading} onRefresh={() => refetchVendor()} tintColor={tokens.brand.default} />}
      >
        <PageHeader title="Settings" subtitle="Shop status, profile and notifications." />

        <View style={{ paddingHorizontal: 16 }}>
          <SectionLabel>Account</SectionLabel>
          <Card style={{ marginBottom: 18 }}>
            <View style={{ padding: 14, gap: 10 }}>
              <TextInput value={firstName} onChangeText={setFirstName} placeholder="First name" placeholderTextColor={tokens.text.placeholder} style={{ backgroundColor: tokens.bg.surfaceMuted, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: tokens.text.primary, borderWidth: 1, borderColor: tokens.border.default }} />
              <TextInput value={lastName} onChangeText={setLastName} placeholder="Last name" placeholderTextColor={tokens.text.placeholder} style={{ backgroundColor: tokens.bg.surfaceMuted, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: tokens.text.primary, borderWidth: 1, borderColor: tokens.border.default }} />
              <TextInput value={phone} onChangeText={setPhone} placeholder="Phone" placeholderTextColor={tokens.text.placeholder} style={{ backgroundColor: tokens.bg.surfaceMuted, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: tokens.text.primary, borderWidth: 1, borderColor: tokens.border.default }} />
              <TouchableOpacity onPress={saveAccount} disabled={savingAccount} style={{ backgroundColor: tokens.brand.default, paddingVertical: 12, borderRadius: 10, alignItems: "center", opacity: savingAccount ? 0.7 : 1 }}>
                <Text style={{ color: tokens.text.onBrand, fontWeight: "700" }}>{savingAccount ? "Saving..." : "Save account"}</Text>
              </TouchableOpacity>
            </View>
          </Card>

          <SectionLabel>Active sessions</SectionLabel>
          <Card style={{ marginBottom: 18 }}>
            {sessions.length === 0 ? (
              <Text style={{ color: tokens.text.muted, padding: 14 }}>No sessions</Text>
            ) : (
              sessions.map((s, idx) => (
                <View key={s.id || idx} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: idx < sessions.length - 1 ? 1 : 0, borderBottomColor: tokens.border.default }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: tokens.text.primary, fontWeight: "600" }}>{s.deviceName || s.deviceModel || "Unknown device"}{s.isCurrent ? " (this device)" : ""}</Text>
                    <Text style={{ color: tokens.text.muted, fontSize: 12 }}>{s.ipAddress || "Unknown IP"}</Text>
                  </View>
                  {!s.isCurrent ? (
                    <TouchableOpacity onPress={() => revokeSession(s.id)}>
                      <Text style={{ color: tokens.status.error, fontWeight: "600", fontSize: 12 }}>Sign out</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))
            )}
            {sessions.length > 1 ? (
              <TouchableOpacity onPress={revokeOthers} style={{ padding: 14 }}>
                <Text style={{ color: tokens.brand.default, fontWeight: "700", fontSize: 12 }}>Sign out other sessions</Text>
              </TouchableOpacity>
            ) : null}
          </Card>

          <SectionLabel>Shop</SectionLabel>
          <Card style={{ marginBottom: 18 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 14,
                paddingVertical: 13,
                borderBottomWidth: 1,
                borderBottomColor: tokens.border.default,
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 11,
                  backgroundColor: vendor?.isOpen ? tokens.status.successSoft : tokens.bg.surfaceMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name={vendor?.isOpen ? "storefront" : "storefront-outline"}
                  size={18}
                  color={vendor?.isOpen ? tokens.status.successStrong : tokens.text.muted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14.5, fontWeight: "600", color: tokens.text.primary }}>
                  {vendor?.isOpen ? "Open for orders" : "Shop closed"}
                </Text>
                <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 1 }}>
                  {vendor?.isOpen ? "Customers can place orders" : "Customers cannot place orders"}
                </Text>
              </View>
              <Switch
                value={!!vendor?.isOpen}
                onValueChange={(v) => toggle.mutate(v)}
                trackColor={{ true: tokens.brand.default, false: tokens.border.strong }}
              />
            </View>

            <ListRow
              icon="storefront-outline"
              title="Shop profile"
              subtitle="Logo, opening hours and location"
              onPress={() => navigation.navigate("SellerShopProfile")}
              right={<Ionicons name="chevron-forward" size={17} color={tokens.text.placeholder} />}
            />
            <ListRow
              icon="pricetags-outline"
              title="Categories"
              subtitle="Manage the categories your shop sells in"
              onPress={() => navigation.navigate("SellerCategories")}
              right={<Ionicons name="chevron-forward" size={17} color={tokens.text.placeholder} />}
              last
            />
          </Card>

          <SectionLabel>Notifications</SectionLabel>
          <Card style={{ marginBottom: 18 }}>
            {notificationPreferences ? (
              NOTIFICATION_ROWS.map((row, index) => (
                <View
                  key={row.key}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 14,
                    paddingVertical: 13,
                    borderBottomWidth: index < NOTIFICATION_ROWS.length - 1 ? 1 : 0,
                    borderBottomColor: tokens.border.default,
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14.5, fontWeight: "600", color: tokens.text.primary }}>{row.label}</Text>
                    <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 1 }}>{row.sub}</Text>
                  </View>
                  <Switch
                    value={!!notificationPreferences[row.key]}
                    onValueChange={(v) => updatePref(row.key, v)}
                    trackColor={{ true: tokens.brand.default, false: tokens.border.strong }}
                    disabled={isUpdating}
                  />
                </View>
              ))
            ) : (
              <LoadingState label="Loading preferences..." />
            )}
          </Card>

          <SectionLabel>Help</SectionLabel>
          <Card>
            <ListRow
              icon="headset-outline"
              title="Support"
              subtitle="Open a ticket with the Marketplace team"
              onPress={() => navigation.navigate("SellerSupport")}
              right={<Ionicons name="chevron-forward" size={17} color={tokens.text.placeholder} />}
              last
            />
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
