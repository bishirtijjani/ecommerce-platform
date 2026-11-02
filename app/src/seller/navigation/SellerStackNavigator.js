import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTheme } from "../../theme";
import SellerHeader from "../components/SellerHeader";
import SellerEntryScreen from "../screens/SellerEntryScreen";
import SellerTabs from "../navigation/SellerTabNavigator";
import SellerOnboardingScreen from "../screens/SellerOnboardingScreen";
import SellerPendingScreen from "../screens/SellerPendingScreen";
import SellerRejectedScreen from "../screens/SellerRejectedScreen";
import SellerSuspendedScreen from "../screens/SellerSuspendedScreen";
import SellerEnrollScreen from "../screens/SellerEnrollScreen";
import SellerOrderDetailScreen from "../screens/SellerOrderDetailScreen";
import SellerProductFormScreen from "../screens/SellerProductFormScreen";
import SellerRequestsScreen from "../screens/SellerRequestsScreen";
import SellerRequestDetailScreen from "../screens/SellerRequestDetailScreen";
import SellerMessagesThreadScreen from "../screens/SellerMessagesThreadScreen";
import SellerAnalyticsScreen from "../screens/SellerAnalyticsScreen";
import SellerMarketingScreen from "../screens/SellerMarketingScreen";
import SellerHighlightsScreen from "../screens/SellerHighlightsScreen";
import SellerCategoriesScreen from "../screens/SellerCategoriesScreen";
import SellerShopProfileScreen from "../screens/SellerShopProfileScreen";
import SellerSettingsScreen from "../screens/SellerSettingsScreen";
import SellerSupportScreen from "../screens/SellerSupportScreen";

const Stack = createNativeStackNavigator();

export default function SellerStackNavigator() {
  return (
    <Stack.Navigator initialRouteName="SellerEntry" screenOptions={{
      header: (props) => <SellerHeader {...props} />,
    }}>
      <Stack.Screen name="SellerEntry" options={{ title: "Seller" }} component={SellerEntryScreen} />
      <Stack.Screen name="SellerTabs" options={{ title: "Seller" }} component={SellerTabs} />
      <Stack.Screen name="SellerEnroll" options={{ title: "Open shop" }} component={SellerEnrollScreen} />
      <Stack.Screen name="SellerOnboarding" options={{ title: "Onboarding" }} component={SellerOnboardingScreen} />
      <Stack.Screen name="SellerPending" options={{ title: "Pending" }} component={SellerPendingScreen} />
      <Stack.Screen name="SellerRejected" options={{ title: "Rejected" }} component={SellerRejectedScreen} />
      <Stack.Screen name="SellerSuspended" options={{ title: "Suspended" }} component={SellerSuspendedScreen} />
      <Stack.Screen name="SellerOrderDetail" options={{ title: "Order" }} component={SellerOrderDetailScreen} />
      <Stack.Screen name="SellerProductForm" options={{ title: "Product" }} component={SellerProductFormScreen} />
      <Stack.Screen name="SellerRequests" options={{ title: "Requests" }} component={SellerRequestsScreen} />
      <Stack.Screen name="SellerRequestDetail" options={{ title: "Request" }} component={SellerRequestDetailScreen} />
      <Stack.Screen name="SellerMessagesThread" options={{ title: "Messages" }} component={SellerMessagesThreadScreen} />
      <Stack.Screen name="SellerAnalytics" options={{ title: "Analytics" }} component={SellerAnalyticsScreen} />
      <Stack.Screen name="SellerMarketing" options={{ title: "Marketing" }} component={SellerMarketingScreen} />
      <Stack.Screen name="SellerHighlights" options={{ title: "Highlights" }} component={SellerHighlightsScreen} />
      <Stack.Screen name="SellerCategories" options={{ title: "Categories" }} component={SellerCategoriesScreen} />
      <Stack.Screen name="SellerShopProfile" options={{ title: "Shop profile" }} component={SellerShopProfileScreen} />
      <Stack.Screen name="SellerSettings" options={{ title: "Settings" }} component={SellerSettingsScreen} />
      <Stack.Screen name="SellerSupport" options={{ title: "Support" }} component={SellerSupportScreen} />
    </Stack.Navigator>
  );
}