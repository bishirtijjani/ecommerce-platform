import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme";
import { useRequestUnreadCount } from "../hooks/useSeller";

// Same grouped rows as the vendor dashboard's "More" sheet: sections of
// icon + label + hint, presented as a slide-up sheet instead of a full tab.
const SECTIONS = [
  {
    title: "Insights",
    items: [
      { label: "Analytics", sub: "Sales, revenue and order history", icon: "bar-chart-outline", screen: "SellerAnalytics" },
      { label: "Requests", sub: "Buyer requests and your quotes", icon: "mail-unread-outline", screen: "SellerRequests", showRequestsBadge: true },
    ],
  },
  {
    title: "Growth",
    items: [
      { label: "Marketing", sub: "Discount codes and campaigns", icon: "megaphone-outline", screen: "SellerMarketing" },
      { label: "Highlights", sub: "Stories shown on your shop", icon: "images-outline", screen: "SellerHighlights" },
    ],
  },
  {
    title: "Shop",
    items: [
      { label: "Categories", sub: "Manage your category taxonomy", icon: "pricetags-outline", screen: "SellerCategories" },
      { label: "Shop profile", sub: "Logo, opening hours and location", icon: "storefront-outline", screen: "SellerShopProfile" },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Settings", sub: "Shop status and notifications", icon: "settings-outline", screen: "SellerSettings" },
      { label: "Support", sub: "Get help from Marketplace", icon: "headset-outline", screen: "SellerSupport" },
    ],
  },
];

export default function SellerMoreSheet({ visible, onClose, onSelect }) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: requestUnread = 0 } = useRequestUnreadCount();
  const badge = requestUnread > 99 ? "99+" : requestUnread;

  const choose = (screen) => {
    onClose();
    onSelect(screen);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: tokens.overlay.scrimSoft }]}
          onPress={onClose}
          accessibilityLabel="Close menu"
          accessibilityRole="button"
        />

        <View
          style={{
            backgroundColor: tokens.bg.surface,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            borderTopWidth: 1,
            borderColor: tokens.border.default,
            maxHeight: "85%",
            paddingBottom: (insets.bottom > 0 ? insets.bottom : 12) + 4,
            width: "100%",
            maxWidth: 620,
            alignSelf: "center",
          }}
        >
          <View style={{ alignItems: "center", paddingTop: 8 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: tokens.border.strong }} />
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 20,
              paddingTop: 8,
              paddingBottom: 4,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 19, fontWeight: "900", color: tokens.text.primary, letterSpacing: -0.3 }}>
                More
              </Text>
              <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 2 }}>
                Shop tools, settings and support
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close menu"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: tokens.bg.surfaceMuted,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="close" size={18} color={tokens.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
            {SECTIONS.map((section) => (
              <View key={section.title} style={{ marginHorizontal: 16, marginTop: 16 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: tokens.text.muted,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    marginBottom: 8,
                    marginLeft: 4,
                  }}
                >
                  {section.title}
                </Text>

                <View
                  style={{
                    backgroundColor: tokens.bg.surface,
                    borderRadius: 16,
                    borderWidth: 1.5,
                    borderColor: tokens.border.default,
                    overflow: "hidden",
                  }}
                >
                  {section.items.map((item, index) => (
                    <TouchableOpacity
                      key={item.screen}
                      onPress={() => choose(item.screen)}
                      activeOpacity={0.6}
                      accessibilityRole="button"
                      accessibilityLabel={item.label}
                      accessibilityHint={item.sub}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        borderBottomWidth: index < section.items.length - 1 ? 1 : 0,
                        borderBottomColor: tokens.border.default,
                      }}
                    >
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          backgroundColor: tokens.brand.soft,
                          borderRadius: 11,
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 12,
                        }}
                      >
                        <Ionicons name={item.icon} size={18} color={tokens.brand.default} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14.5, fontWeight: "600", color: tokens.text.primary, marginBottom: 1 }}>
                          {item.label}
                        </Text>
                        <Text style={{ fontSize: 12, color: tokens.text.muted }}>{item.sub}</Text>
                      </View>

                      {item.showRequestsBadge && requestUnread > 0 ? (
                        <View
                          style={{
                            minWidth: 20,
                            height: 20,
                            borderRadius: 10,
                            paddingHorizontal: 6,
                            backgroundColor: tokens.brand.default,
                            alignItems: "center",
                            justifyContent: "center",
                            marginRight: 8,
                          }}
                        >
                          <Text style={{ color: tokens.text.onBrand, fontSize: 10, fontWeight: "800" }}>{badge}</Text>
                        </View>
                      ) : null}

                      <Ionicons name="chevron-forward" size={16} color={tokens.text.placeholder} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
