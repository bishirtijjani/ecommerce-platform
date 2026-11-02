import React from "react";
import { Pressable, Text, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Screens
import HomeStackNavigator from "./HomeStackNavigator";
import ChatsScreen from "../screens/main/ChatsScreen";
import CartScreen from "../screens/main/CartScreen";
import SellScreen from "../screens/main/SellScreen";
import ProfileScreen from "../screens/profile/ProfileScreen";

const Tab = createBottomTabNavigator();

// Raised circular Cart button, matching the approved mock's center FAB.
// Cart doubles as "Saved" (see savedItemsSlice) - no checkout exists yet.
//
// This replaces the default tab button entirely instead of only supplying an
// icon. The default item lays the icon slot out on its own and lets the label
// flow underneath; a 52px circle with a negative margin then overlapped the
// label (most visible on wide/web layouts). Owning the whole item lets the
// circle and label share fixed vertical space at every width.
function CartTabButton({ tokens, focused, label, badge, style, ...rest }) {
  return (
    <Pressable
      {...rest}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        style,
        {
          flex: 1,
          alignItems: "center",
          justifyContent: "flex-start",
          paddingTop: 0,
          paddingBottom: 0,
        },
      ]}
    >
      <View
        style={{
          width: 50,
          height: 50,
          borderRadius: 25,
          marginTop: -16,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: tokens.brand.default,
          shadowColor: tokens.brand.default,
          shadowOpacity: 0.35,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
      >
        <Ionicons name={focused ? "bag-handle" : "bag-handle-outline"} size={23} color={tokens.text.onBrand} />
        {badge ? (
          <View
            style={{
              position: "absolute",
              top: -3,
              right: -3,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              paddingHorizontal: 4,
              backgroundColor: tokens.status.error,
              borderWidth: 2,
              borderColor: tokens.bg.surface,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 9, fontWeight: "800" }}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text
        style={{
          marginTop: 6,
          fontSize: 12,
          fontWeight: "500",
          color: focused ? tokens.brand.default : tokens.text.muted,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function MainTabNavigator() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  // Both selectors must run on every render: short-circuiting the second one
  // changes the hook order once auth hydration populates `vendorId`, which
  // crashes every hook after it (useTranslation's useMemo) on the next render.
  const authVendorId = useSelector((s) => s.auth?.user?.vendorId);
  const profileVendorId = useSelector((s) => s.profile?.profile?.vendorId);
  const hasShop = Boolean(authVendorId || profileVendorId);
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const savedCount = useSelector((s) => s.savedItems.items?.length ?? 0);
  const chatUnreadCount = useSelector((s) => s.chat.unreadCount);

  return (
    <Tab.Navigator
      // Opaque per-scene background. bottom-tabs does NOT apply the navigation
      // theme's `background` to tab scenes - they're transparent by default - so
      // without this, web tab switches briefly reveal the other tabs' content
      // through the incoming screen. `sceneStyle` is the intended API for it.
      sceneStyle={{ backgroundColor: tokens.bg.canvas }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          if (route.name === "CartTab") return null; // rendered via tabBarButton
          let iconName;
          if (route.name === "HomeTab") iconName = focused ? "home" : "home-outline";
          else if (route.name === "ChatsTab") iconName = focused ? "chatbubble" : "chatbubble-outline";
          else if (route.name === "SellTab") iconName = focused ? "storefront" : "storefront-outline";
          else if (route.name === "AccountTab") iconName = focused ? "person" : "person-outline";
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: tokens.brand.default,
        tabBarInactiveTintColor: tokens.text.muted,
        // Keep one layout at every width. The default flips to icon-beside-label
        // on wide/web screens, which broke the raised Cart item and made the
        // whole bar inconsistent.
        tabBarLabelPosition: "below-icon",
        tabBarStyle: {
          backgroundColor: tokens.bg.surface,
          borderTopWidth: 1,
          borderTopColor: tokens.border.default,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 5,
          height: 60 + (insets.bottom > 0 ? insets.bottom : 8),
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
        },
        tabBarBadgeStyle: {
          backgroundColor: tokens.brand.default,
          color: tokens.text.onBrand,
          fontSize: 10,
          fontWeight: "800",
          minWidth: 18,
          height: 18,
          lineHeight: 18,
        },
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeStackNavigator} options={{ title: "Home" }} />
      <Tab.Screen
        name="ChatsTab"
        component={ChatsScreen}
        options={{
          title: "Chats",
          tabBarBadge: chatUnreadCount > 0 ? (chatUnreadCount > 99 ? "99+" : chatUnreadCount) : undefined,
        }}
      />
      <Tab.Screen
        name="CartTab"
        component={CartScreen}
        options={{
          title: "Cart",
          // The whole item (circle + label + badge) is ours; the navigator
          // must not add its own icon/label on top.
          tabBarIcon: () => null,
          tabBarLabel: () => null,
          tabBarButton: (props) => (
            <CartTabButton
              {...props}
              tokens={tokens}
              focused={props.accessibilityState?.selected}
              label="Cart"
              badge={savedCount > 0 ? (savedCount > 99 ? "99+" : savedCount) : undefined}
            />
          ),
        }}
      />
      <Tab.Screen
        name="SellTab"
        component={SellScreen}
        listeners={{
          tabPress: (e) => {
            if (hasShop) {
              e.preventDefault();
              navigation.navigate("Seller");
            }
          },
        }}
        options={{ title: t("tabs.sell") }}
      />
      <Tab.Screen name="AccountTab" component={ProfileScreen} options={{ title: "Account" }} />
    </Tab.Navigator>
  );
}
