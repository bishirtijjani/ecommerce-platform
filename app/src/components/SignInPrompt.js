/**
 * SignInPrompt - shown inside an account-gated tab (Chats/Orders/Account)
 * when the visitor isn't signed in. Browsing (Home/Shops/Cart) stays fully
 * public - only screens that inherently need to know who you are gate here,
 * inline rather than forcing a redirect.
 */

import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import EmptyState from "./EmptyState";
import { useTheme } from "../theme";

export default function SignInPrompt({ icon, title, subtitle }) {
  const navigation = useNavigation();
  const { tokens } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <EmptyState
        icon={icon || "log-in-outline"}
        title={title || "Sign in to continue"}
        subtitle={subtitle || "Create an account or sign in to see this."}
        ctaLabel="Sign In"
        onCta={() => navigation.navigate("Login")}
      />
    </SafeAreaView>
  );
}
