import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

// The customer app is a marketplace, so browsing (shops, categories, products)
// lives INSIDE the Home tab as a nested stack. That keeps the bottom tab bar
// visible while the user drills into a shop, a category or a product detail -
// otherwise those screens would cover the whole screen and hide navigation.
// The root stack in AppNavigator holds MainTabs plus full-screen destinations
// (auth, profile, support, chat thread, notifications).
import HomeScreen from "../screens/main/HomeScreen";
import ShopsScreen from "../screens/main/ShopsScreen";
import CategoriesScreen from "../screens/main/CategoriesScreen";
import AllCategoriesScreen from "../screens/main/AllCategoriesScreen";
import ChinaMarketScreen from "../screens/main/ChinaMarketScreen";
import ArabWorldScreen from "../screens/main/ArabWorldScreen";
import WholesalersScreen from "../screens/main/WholesalersScreen";
import SecondHandScreen from "../screens/main/SecondHandScreen";
import MarketplaceCategoryScreen from "../screens/main/MarketplaceCategoryScreen";
import VendorStorefrontScreen from "../screens/main/VendorStorefrontScreen";
import VendorCategoryProductsScreen from "../screens/main/VendorCategoryProductsScreen";
import ProductDetailScreen from "../screens/main/ProductDetailScreen";
import CategoryScreen from "../screens/main/CategoryScreen";
import SubcategoryScreen from "../screens/main/SubcategoryScreen";

const Stack = createNativeStackNavigator();

export default function HomeStackNavigator() {
  return (
    <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Shops" component={ShopsScreen} />
      <Stack.Screen name="AllCategories" component={CategoriesScreen} />
      <Stack.Screen name="AllCategoriesList" component={AllCategoriesScreen} />
      <Stack.Screen name="ChinaMarket" component={ChinaMarketScreen} />
      <Stack.Screen name="ArabWorld" component={ArabWorldScreen} />
      <Stack.Screen name="Wholesalers" component={WholesalersScreen} />
      <Stack.Screen name="SecondHand" component={SecondHandScreen} />
      <Stack.Screen name="MarketplaceCategory" component={MarketplaceCategoryScreen} />
      <Stack.Screen name="VendorStorefront" component={VendorStorefrontScreen} />
      <Stack.Screen name="VendorCategoryProducts" component={VendorCategoryProductsScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="CategoryLanding" component={CategoryScreen} />
      <Stack.Screen name="Subcategory" component={SubcategoryScreen} />
    </Stack.Navigator>
  );
}
