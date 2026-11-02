import React from "react";
import { goBackOr } from "../../lib/goBack";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme";

export default function HelpSupportScreen({ navigation }) {
  const { t } = useTranslation();
  const { tokens, isDark } = useTheme();

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: tokens.bg.canvas }}
      edges={["top"]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={tokens.bg.canvas}
      />
      <View style={{ height: 4, backgroundColor: tokens.brand.default }} />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingVertical: 16,
        }}
      >
        <TouchableOpacity
          onPress={() => goBackOr(navigation)}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.back")}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: tokens.bg.surfaceMuted,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 14,
          }}
        >
          <Ionicons name="arrow-back" size={20} color={tokens.text.primary} />
        </TouchableOpacity>
        <Text
          accessibilityRole="header"
          style={{
            fontSize: 20,
            fontWeight: "900",
            color: tokens.text.primary,
            letterSpacing: -0.5,
          }}
        >
          {t("help.title")}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        {/* Quick actions - open tickets */}
        <View style={{ marginHorizontal: 20, marginBottom: 24, gap: 10 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate("CreateSupportTicket")}
            activeOpacity={0.85}
            accessibilityRole="button"
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: tokens.brand.default,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 12,
              gap: 12,
            }}
          >
            <View
              style={{
                width: 38,
                height: 38,
                backgroundColor: "rgba(255,255,255,0.18)",
                borderRadius: 11,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="create-outline" size={19} color={tokens.text.onBrand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: tokens.text.onBrand }}>
                {t("support.createTicket")}
              </Text>
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>
                {t("support.createTicketSub")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate("MyTickets")}
            activeOpacity={0.6}
            accessibilityRole="button"
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: tokens.bg.surface,
              borderWidth: 1.5,
              borderColor: tokens.border.default,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 12,
              gap: 12,
            }}
          >
            <View
              style={{
                width: 38,
                height: 38,
                backgroundColor: tokens.bg.surfaceMuted,
                borderRadius: 11,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="folder-open-outline" size={19} color={tokens.text.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: tokens.text.primary }}>
                {t("support.myTickets")}
              </Text>
              <Text style={{ fontSize: 12, color: tokens.text.muted }}>
                {t("support.myTicketsSub")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={tokens.text.placeholder} />
          </TouchableOpacity>
        </View>

        {/* Contact */}
        <View style={{ marginHorizontal: 20 }}>
          <Text
            accessibilityRole="header"
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: tokens.text.muted,
              letterSpacing: 1,
              textTransform: "uppercase",
              marginBottom: 10,
              marginLeft: 4,
            }}
          >
            {t("help.contactHeader")}
          </Text>
          <View
            style={{
              backgroundColor: tokens.bg.surface,
              borderRadius: 18,
              borderWidth: 1.5,
              borderColor: tokens.border.default,
              overflow: "hidden",
            }}
          >
            {[
              {
                icon: "chatbubble-ellipses-outline",
                label: t("help.chatLabel"),
                sub: t("help.chatSub"),
                onPress: () => navigation.navigate("CreateSupportTicket"),
              },
              {
                icon: "mail-outline",
                label: t("help.emailLabel"),
                sub: t("help.emailValue"),
                onPress: () => Linking.openURL(`mailto:${t("help.emailValue")}`),
              },
            ].map((item, index) => (
              <TouchableOpacity
                key={item.label}
                onPress={item.onPress}
                activeOpacity={0.6}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                accessibilityHint={item.sub}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderBottomWidth: index < 1 ? 1 : 0,
                  borderBottomColor: tokens.border.default,
                }}
              >
                <View
                  style={{
                    width: 38,
                    height: 38,
                    backgroundColor: tokens.bg.surfaceMuted,
                    borderRadius: 11,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 14,
                  }}
                >
                  <Ionicons name={item.icon} size={19} color={tokens.text.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "600",
                      color: tokens.text.primary,
                      marginBottom: 1,
                    }}
                  >
                    {item.label}
                  </Text>
                  <Text style={{ fontSize: 12, color: tokens.text.muted }}>
                    {item.sub}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={17}
                  color={tokens.text.placeholder}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
