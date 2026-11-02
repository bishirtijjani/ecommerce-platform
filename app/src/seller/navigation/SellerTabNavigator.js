import React, { useState } from "react";
import { View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme";
import { useChatUnreadCount, useRequestUnreadCount } from "../hooks/useSeller";
import SellerDashboardScreen from "../screens/SellerDashboardScreen";
import SellerOrdersScreen from "../screens/SellerOrdersScreen";
import SellerProductsScreen from "../screens/SellerProductsScreen";
import SellerMessagesScreen from "../screens/SellerMessagesScreen";
import SellerMoreSheet from "../components/SellerMoreSheet";

const Tab = createBottomTabNavigator();

// The More tab never renders a screen - its tabPress opens the sheet instead.
const MorePlaceholder = () => null;

export default function SellerTabNavigator() {
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const navigation = useNavigation();
  const [moreOpen, setMoreOpen] = useState(false);
  const chatUnreadQuery = useChatUnreadCount();
  const chatUnread = chatUnreadQuery?.data || 0;
  const reqUnreadQuery = useRequestUnreadCount();
  const reqUnread = reqUnreadQuery?.data || 0;
  return (
    <>
    <Tab.Navigator
      sceneStyle={{ backgroundColor: tokens.bg.canvas }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.brand.default,
        tabBarInactiveTintColor: tokens.text.muted,
        tabBarLabelPosition: "below-icon",
        tabBarStyle: {
          backgroundColor: tokens.bg.surface,
          borderTopWidth: 1,
          borderTopColor: tokens.border.default,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 5,
          height: 60 + (insets.bottom > 0 ? insets.bottom : 8),
        },
      }}
    >
      <Tab.Screen name="SellerDashboard" component={SellerDashboardScreen} options={{ title: "Dashboard", tabBarIcon: ({ focused, color, size }) => <Ionicons name={focused ? "grid" : "grid-outline"} size={size} color={color} /> }} />
      <Tab.Screen name="SellerOrders" component={SellerOrdersScreen} options={{ title: "Orders", tabBarIcon: ({ focused, color, size }) => <Ionicons name={focused ? "receipt" : "receipt-outline"} size={size} color={color} />, tabBarBadge: (reqUnread + 0) > 0 ? (reqUnread > 99 ? "99+" : reqUnread) : undefined }} />
      <Tab.Screen name="SellerProducts" component={SellerProductsScreen} options={{ title: "Products", tabBarIcon: ({ focused, color, size }) => <Ionicons name={focused ? "cube" : "cube-outline"} size={size} color={color} /> }} />
      <Tab.Screen name="SellerMessages" component={SellerMessagesScreen} options={{ title: "Messages", tabBarIcon: ({ focused, color, size }) => <Ionicons name={focused ? "chatbubble" : "chatbubble-outline"} size={size} color={color} />, tabBarBadge: chatUnread > 0 ? (chatUnread > 99 ? "99+" : chatUnread) : undefined }} />
      <Tab.Screen
        name="SellerMore"
        component={MorePlaceholder}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            setMoreOpen(true);
          },
        }}
        options={{ title: "More", tabBarIcon: ({ focused, color, size }) => <Ionicons name={focused ? "ellipsis-horizontal" : "ellipsis-horizontal-outline"} size={size} color={color} /> }}
      />
    </Tab.Navigator>

    <SellerMoreSheet
      visible={moreOpen}
      onClose={() => setMoreOpen(false)}
      onSelect={(screen) => navigation.navigate(screen)}
    />
    </>
  );
}