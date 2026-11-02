import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import FormInput from "../../components/FormInput";
import { useTheme } from "../../theme";
import { vendorEnroll } from "../api/vendorApi";
import { fetchProfile } from "../../store/slices/profileSlice";

export default function SellerEnrollScreen({ navigation }) {
  const { tokens } = useTheme();
  const dispatch = useDispatch();
  const profile = useSelector((s) => s.profile.profile);
  const [businessName, setBusinessName] = useState("");
  const [businessPhone, setBusinessPhone] = useState(profile?.phone || "");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (businessName.trim().length < 2) return setError("Shop name required");
    if (businessPhone.trim().length < 10) return setError("Phone required");
    if (address.trim().length < 5) return setError("Address required");
    setBusy(true);
    try {
      await vendorEnroll({
        businessName: businessName.trim(),
        businessPhone: businessPhone.trim(),
        businessAddress: address.trim(),
      });
      await dispatch(fetchProfile());
      navigation.replace("SellerEntry");
    } catch (e) {
      setError(e?.message || "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <ScrollView
        style={{ width: "100%", maxWidth: 640, alignSelf: "center" }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
                <FormInput label="Shop name" value={businessName} onChangeText={setBusinessName} placeholder="My Shop" />
        <FormInput label="Shop phone" value={businessPhone} onChangeText={setBusinessPhone} placeholder="080..." />
        <FormInput label="Shop address" value={address} onChangeText={setAddress} placeholder="Street address" />
        {error ? <Text style={{ color: tokens.status.error, marginBottom: 12 }}>{error}</Text> : null}
        <TouchableOpacity onPress={submit} disabled={busy} style={{ backgroundColor: tokens.brand.default, paddingVertical: 14, borderRadius: 12, alignItems: "center", opacity: busy ? 0.7 : 1 }}>
          {busy ? <ActivityIndicator color={tokens.text.onBrand} /> : <Text style={{ color: tokens.text.onBrand, fontWeight: "800" }}>Open my shop</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}