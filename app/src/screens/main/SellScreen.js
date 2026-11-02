/**
 * SellScreen - the "Sell on MySooq" tab.
 *
 * Replaces the old Orders tab (customers rarely track orders in this
 * chat-commerce app). It is the visible, one-tap way for a customer to open
 * their own shop: signed out it prompts sign-in, signed in without a shop it
 * hands off to the vendor web wizard, and once a shop exists it shows status
 * and links to the seller dashboard.
 */

import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { useTheme } from "../../theme";
import SignInPrompt from "../../components/SignInPrompt";

const STEPS = ["shop.step1", "shop.step2", "shop.step3"];

export default function SellScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { tokens, isDark } = useTheme();
  const { user, isAuthenticated } = useSelector((s) => s.auth);
  const { profile } = useSelector((s) => s.profile);
  const [busy, setBusy] = useState(false);
  const autoNavigatedRef = useRef(false);

  const p = profile || user || {};
  const hasShop = !!(user?.vendorId || p?.vendorId);

  // A shop owner should never sit on this marketing screen. The Sell tab's
  // tabPress listener handles the normal tap path; this covers the cases where
  // the screen is already focused/mounted when the vendorId hydrates (or the
  // user just finished enrolling).
  useEffect(() => {
    if (!hasShop) return undefined;

    const redirect = () => {
      if (autoNavigatedRef.current) return;
      if (!navigation.isFocused()) return;
      autoNavigatedRef.current = true;
      navigation.navigate("Seller");
    };

    const unsubscribe = navigation.addListener("focus", redirect);
    redirect();
    return unsubscribe;
  }, [hasShop, navigation]);

  if (!isAuthenticated) {
    return <SignInPrompt icon="storefront-outline" title={t("shop.signInTitle")} />;
  }

  const status = p.roles?.vendor;
  const statusLabel =
    status === "APPROVED"
      ? t("settings.rows.yourShopActive")
      : status === "PENDING_APPROVAL"
      ? t("settings.rows.yourShopPending")
      : t("settings.rows.yourShopPaused");

  const onPrimary = async () => {
    navigation.navigate("Seller");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={tokens.bg.canvas}
      />
      <View style={{ height: 4, backgroundColor: tokens.brand.default }} />

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            fontSize: 26,
            fontWeight: "900",
            color: tokens.text.primary,
            letterSpacing: -0.6,
          }}
        >
          {t("shop.heroTitle")}
        </Text>
        <Text style={{ fontSize: 14, color: tokens.text.muted, marginTop: 6, lineHeight: 21 }}>
          {hasShop ? statusLabel : t("shop.heroSub")}
        </Text>

        <View
          style={{
            marginTop: 22,
            backgroundColor: tokens.brand.default,
            borderRadius: 20,
            padding: 22,
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: "rgba(255,255,255,0.18)",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Ionicons name="storefront" size={28} color={tokens.text.onBrand} />
          </View>
          <Text style={{ color: tokens.text.onBrand, fontSize: 19, fontWeight: "800" }}>
            {hasShop ? t("settings.rows.yourShop") : t("settings.rows.openShop")}
          </Text>
          <Text
            style={{
              color: "rgba(255,255,255,0.85)",
              fontSize: 13,
              marginTop: 6,
              lineHeight: 19,
            }}
          >
            {hasShop ? statusLabel : t("settings.rows.openShopSub")}
          </Text>

          <TouchableOpacity
            onPress={onPrimary}
            disabled={busy}
            activeOpacity={0.85}
            accessibilityRole="button"
            style={{
              marginTop: 18,
              backgroundColor: tokens.bg.surface,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? (
              <ActivityIndicator color={tokens.brand.default} />
            ) : (
              <>
                <Ionicons
                  name={hasShop ? "open-outline" : "storefront-outline"}
                  size={18}
                  color={tokens.brand.default}
                />
                <Text
                  style={{
                    color: tokens.brand.default,
                    fontWeight: "800",
                    fontSize: 15,
                    marginLeft: 8,
                  }}
                >
                  {hasShop ? t("settings.rows.yourShopActive") : t("settings.rows.openShop")}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {!hasShop && (
          <View
            style={{
              marginTop: 26,
              backgroundColor: tokens.bg.surfaceMuted,
              borderRadius: 16,
              padding: 16,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: tokens.text.muted,
                letterSpacing: 1,
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              {t("shop.howTitle")}
            </Text>
            {STEPS.map((key, index) => (
              <View
                key={key}
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  marginBottom: index === STEPS.length - 1 ? 0 : 10,
                }}
              >
                <Text
                  style={{
                    width: 18,
                    color: tokens.text.muted,
                    fontSize: 13,
                    fontWeight: "700",
                  }}
                >
                  {index + 1}.
                </Text>
                <Text
                  style={{
                    flex: 1,
                    color: tokens.text.muted,
                    fontSize: 13,
                    lineHeight: 19,
                  }}
                >
                  {t(key)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
