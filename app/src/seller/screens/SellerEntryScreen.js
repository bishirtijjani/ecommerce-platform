import React, { useEffect } from "react";
import { View, ActivityIndicator, Text, TouchableOpacity } from "react-native";
import { useSelector } from "react-redux";
import { useVendorProfile } from "../hooks/useSeller";
import { useTheme } from "../../theme";
import SignInPrompt from "../../components/SignInPrompt";

const hasUsablePin = (vendor) => {
  const lat = Number(vendor?.lat);
  const lng = Number(vendor?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
};

const needsOnboarding = (vendor) => {
  if (!vendor) return false;
  if (typeof vendor.locationComplete === "boolean") return !vendor.locationComplete;
  return (
    vendor.address === "Pending - set in onboarding" ||
    !vendor.state ||
    !vendor.lga ||
    !hasUsablePin(vendor)
  );
};

export default function SellerEntryScreen({ navigation }) {
  const { tokens } = useTheme();
  const { isAuthenticated } = useSelector((s) => s.auth);
  const profile = useSelector((s) => s.profile.profile);
  const user = useSelector((s) => s.auth.user);
  const vendorId = user?.vendorId || profile?.vendorId;
  const { data: vendor, isLoading, isError, refetch } = useVendorProfile();

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!vendorId) {
      navigation.replace("SellerEnroll");
      return;
    }
    if (isLoading) return;
    if (isError || !vendor) {
      // Don't hang; let the user retry or enroll.
      return;
    }
    if (vendor.status === "PENDING_APPROVAL" && needsOnboarding(vendor)) {
      navigation.replace("SellerOnboarding");
    } else if (vendor.status === "REJECTED") {
      navigation.replace("SellerRejected");
    } else if (vendor.status === "SUSPENDED") {
      navigation.replace("SellerSuspended");
    } else {
      navigation.replace("SellerTabs");
    }
  }, [isAuthenticated, vendorId, isLoading, isError, vendor, navigation]);

  if (!isAuthenticated) {
    return <SignInPrompt icon="storefront-outline" title="Sign in to manage your shop" />;
  }

  if (isError) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: tokens.bg.canvas, padding: 24 }}>
        <Text style={{ color: tokens.text.primary, fontWeight: "700", marginBottom: 8 }}>Could not load shop</Text>
        <TouchableOpacity onPress={() => refetch()} style={{ backgroundColor: tokens.brand.default, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 }}>
          <Text style={{ color: tokens.text.onBrand, fontWeight: "700" }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: tokens.bg.canvas }}>
      <ActivityIndicator color={tokens.brand.default} />
      <Text style={{ marginTop: 12, color: tokens.text.muted }}>Loading shop…</Text>
    </View>
  );
}