import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, ActivityIndicator, Text, TouchableOpacity, AppState, Linking, Platform, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useSelector, useDispatch } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { hydrateAuth, logout } from "../store/slices/authSlice";
import socketService from "../services/socket";
import { ensureFreshAccessToken } from "../services/api";
import { fetchPublicSettings } from "../store/slices/settingsSlice";
import { hydrateSavedItemsFromStorage } from "../store/slices/savedItemsSlice";
import { fetchProfile } from "../store/slices/profileSlice";
import { hydrateLocation } from "../store/slices/locationSlice";
import {
  fetchUnreadCount,
  notificationReceived,
} from "../store/slices/notificationsSlice";
import { subscribeSocketToStore } from "../services/notificationsBus";
import {
  fetchChatUnreadCount,
  chatMessageReceived,
  chatConversationUpdated,
} from "../store/slices/chatSlice";
import { subscribeChatSocketToStore } from "../services/chatBus";
import { routeToScreen, parseDeepLink } from "../lib/notificationRoute";
import {
  parseIntentFromUrl,
  setPendingIntent,
  getPendingIntent,
  clearPendingIntent,
  hydratePendingIntent,
  actionForIntent,
} from "../lib/pendingIntent";
import {
  isBiometricAvailable,
  isBiometricEnabled,
  authenticateWithBiometric,
} from "../services/biometric";
import { useTheme, buildNavigationTheme } from "../theme";
import NotificationPermissionBanner from "../components/NotificationPermissionBanner";

// Auth Screens
import LoginScreen from "../screens/auth/LoginScreen";
import RegisterScreen from "../screens/auth/RegisterScreen";
import OtpVerificationScreen from "../screens/auth/OtpVerificationScreen";
import ForgotPasswordScreen from "../screens/auth/ForgotPasswordScreen";
import ResetPasswordScreen from "../screens/auth/ResetPasswordScreen";

// Main
import MainTabNavigator from "./MainTabNavigator";

// Profile Screens (Profile is now a stack screen reachable via the home
// header's avatar, not a bottom tab - that slot is the cart now.)
import ProfileScreen from "../screens/profile/ProfileScreen";
import EditProfileScreen from "../screens/profile/EditProfileScreen";
import ProfilePhotoScreen from "../screens/profile/ProfilePhotoScreen";
import PhoneCaptureScreen from "../screens/profile/PhoneCaptureScreen";
import NotificationSettingsScreen from "../screens/profile/NotificationSettingsScreen";
import HelpSupportScreen from "../screens/profile/HelpSupportScreen";
import LegalScreen from "../screens/profile/LegalScreen";

// Location
import LocationPickerScreen from "../screens/location/LocationPickerScreen";

// Chat thread (list lives in the ChatsTab; the thread itself is a stack screen)
import ChatThreadScreen from "../screens/main/ChatThreadScreen";

// Order history (moved out of the bottom tabs - that slot is "Sell" now)
import OrdersScreen from "../screens/main/OrdersScreen";

// Security / Sessions
import SessionsScreen from "../screens/profile/SessionsScreen";

// Notification Center
import NotificationCenterScreen from "../screens/main/NotificationCenterScreen";

// Support
import MyTicketsScreen from "../screens/support/MyTicketsScreen";
import SupportChatScreen from "../screens/support/SupportChatScreen";
import CreateTicketScreen from "../screens/support/CreateTicketScreen";
import TicketDetailScreen from "../screens/support/TicketDetailScreen";
import CreateDisputeScreen from "../screens/support/CreateDisputeScreen";
import DisputeDetailScreen from "../screens/support/DisputeDetailScreen";

// Seller (vendor dashboard in-app)
import SellerStackNavigator from "../seller/navigation/SellerStackNavigator";
import SearchResultsScreen from "../screens/main/SearchResultsScreen";
import RequestComposeScreen from "../screens/main/RequestComposeScreen";
import MyRequestsScreen from "../screens/main/MyRequestsScreen";
import RequestDetailScreen from "../screens/main/RequestDetailScreen";

const Stack = createNativeStackNavigator();

// react-navigation deep-link config - pairs with the `mysooq` scheme in app.json.
// The route paths mirror the conventions in services/notify.service.js so the
// server can produce a `data.route` like "/request/abc" and either:
//   - in-app: notificationRoute.routeToScreen handles dispatch via navigation.navigate
//   - tray-tap: react-navigation's Linking handler parses the full URL on cold start
// Deep-link config. Tab screen names MUST match the MainTabNavigator's
// `HomeTab/ChatsTab/CartTab/SellTab/AccountTab` exactly - react-navigation
// throws "screen not found" on a name mismatch. notificationRoute.js builds
// the same screen names. Profile and Orders are top-level stack screens, not
// tabs (the Orders slot is "Sell" now).
//
// Note on scheme: `mysooq://` is this app's own custom scheme, registered on
// device at install time. The universal-link domains are
// ecommerce-customer.codeket.com (legacy) and customer.mysooq.ng (canonical).
const NAV_LINKING = {
  prefixes: ["mysooq://", "https://ecommerce-customer.codeket.com", "https://customer.mysooq.ng"],
  config: {
    screens: {
      MainTabs: {
        screens: {
          HomeTab: "home",
          ChatsTab: "chats",
          CartTab: "cart",
          SellTab: "sell",
          AccountTab: "account",
        },
      },
      Profile: "profile",
      Orders: "orders",
      NotificationCenter: "notifications",
      ChatThread: "chat/:conversationId",
      SupportChat: "support/chat",
      MyTickets: "support",
      CreateSupportTicket: "support/new",
      SupportTicketDetail: "support/ticket/:ticketId",
      CreateDispute: "support/dispute/new/:requestId",
      SupportDisputeDetail: "support/dispute/:disputeId",
      SearchResults: "search",
      RequestCompose: "requests/new",
      MyRequests: "requests",
      RequestDetail: "requests/:requestId",
    },
  },
};

export default function AppNavigator() {
  const dispatch = useDispatch();
  const { isAuthenticated, isHydrating, user } = useSelector((state) => state.auth);
  const { tokens, isDark } = useTheme();

  // Read inside the chat socket bridge's callback (set up once per auth
  // session) instead of captured in a stale closure.
  const currentUserIdRef = useRef(user?.id || null);
  useEffect(() => { currentUserIdRef.current = user?.id || null; }, [user?.id]);
  const navigationTheme = useMemo(
    () => buildNavigationTheme(tokens, isDark),
    [tokens, isDark]
  );

  // navigationRef - used by the push-tap handler to navigate when there's
  // no useNavigation hook available (background → tray tap → cold start).
  const navigationRef = useRef(null);

  // Mirror auth + biometric gate into refs so replayPendingIntent (called from
  // async callbacks and onNavReady) reads current values without stale closures.
  const isAuthenticatedRef = useRef(isAuthenticated);
  useEffect(() => { isAuthenticatedRef.current = isAuthenticated; }, [isAuthenticated]);

  // Biometric gate states:
  //   'pending'  - checking whether to prompt
  //   'required' - user enabled biometrics; show locked screen + retry
  //   'passed'   - authenticated this session; main UI may render
  const [bioGate, setBioGate] = useState("pending");
  const bioGateRef = useRef(bioGate);
  useEffect(() => { bioGateRef.current = bioGate; }, [bioGate]);

  // Push-tap that arrived before NavigationContainer was ready. Replayed on
  // first render of the authenticated stack.
  const pendingActionRef = useRef(null);

  // Navigate to a pending order intent (from a `?intent=` web entry link) once
  // the user is authenticated, past the biometric gate, and the navigator is
  // ready. Idempotent - clears the intent so it fires at most once. No-op when
  // there's no intent (every normal native open), or when called too early
  // (a later trigger - onNavReady or the post-login effect - will retry).
  function replayPendingIntent() {
    const intent = getPendingIntent();
    if (!intent) return;
    if (!isAuthenticatedRef.current || bioGateRef.current !== "passed") return;
    if (!navigationRef.current?.isReady?.()) return;
    const action = actionForIntent(intent);
    clearPendingIntent();
    if (!action) return;
    try {
      navigationRef.current.navigate(action.name, action.params);
    } catch (_) {}
  }

  useEffect(() => {
    dispatch(hydrateAuth());
    dispatch(fetchPublicSettings());
    dispatch(hydrateLocation());
    // Saved items are user-scoped but the persisted blob is removed on forced
    // logout (see store/index.js), so it's safe to read on every cold start
    // before we know who's signed in - the worst case is an empty read.
    dispatch(hydrateSavedItemsFromStorage());
  }, [dispatch]);

  // Phase 5 - handle push tap (foreground + background) and cold-start deep links.
  useEffect(() => {
    // Tap on a delivered notification → navigate.
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data || {};
      const action = routeToScreen({ data, requestId: data.requestId, transactionId: data.transactionId });
      if (!action) return;
      if (navigationRef.current?.isReady?.()) {
        navigationRef.current.navigate(action.name, action.params);
      } else {
        pendingActionRef.current = action;
      }
    });

    // Cold-start: did the app open from a notification tap (and not yet
    // delivered to the listener)?
    (async () => {
      const last = await Notifications.getLastNotificationResponseAsync();
      if (last) {
        const data = last.notification?.request?.content?.data || {};
        const action = routeToScreen({ data, requestId: data.requestId, transactionId: data.transactionId });
        if (action) pendingActionRef.current = action;
      }
      // Or from a deep-link URL.
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        const action = parseDeepLink(initialUrl);
        if (action) pendingActionRef.current = action;
        // Marketing-site order intent (`?intent=food` etc.). On native opens
        // there's no such param, so this stays null and nothing changes.
        const intent = parseIntentFromUrl(initialUrl);
        if (intent) setPendingIntent(intent);
      }
      // Recover an intent persisted across a hard web reload that dropped the
      // query string. If already signed in, fire it now; otherwise it waits
      // for the post-login effect below.
      await hydratePendingIntent();
      replayPendingIntent();
    })();

    return () => sub.remove();
  }, []);

  // Web only: the browser service worker (public/sw.js) posts a
  // `notification-click` message when a push notification is tapped while the
  // PWA already has a window open. Route it through the same mapping.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof navigator === "undefined" || !navigator.serviceWorker) return undefined;
    const onMessage = (event) => {
      const msg = event?.data;
      if (!msg) return;
      if (msg.type === "push-resubscribe") {
        // The browser rotated our PushSubscription (or it expired). Re-register
        // silently - registerPushToken reuses the fresh subscription.
        import("../services/notifications")
          .then((m) => m.registerPushToken())
          .catch(() => {});
        return;
      }
      if (msg.type !== "notification-click") return;
      const data = msg.data || {};
      const action = routeToScreen({ data, requestId: data.requestId, transactionId: data.transactionId });
      if (!action) return;
      if (navigationRef.current?.isReady?.()) {
        navigationRef.current.navigate(action.name, action.params);
      } else {
        pendingActionRef.current = action;
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  // Replay a pending order intent once the user signs in and clears the
  // biometric gate - this is the logged-out → login → resume path. Deferred a
  // tick because the isAuthenticated flip re-renders the navigator in the same
  // commit, so the authenticated stack's screens must register first.
  useEffect(() => {
    if (!isAuthenticated || bioGate !== "passed") return undefined;
    if (!getPendingIntent()) return undefined;
    const id = setTimeout(() => replayPendingIntent(), 0);
    return () => clearTimeout(id);
  }, [isAuthenticated, bioGate]);

  // After hydration, decide whether the user must pass a biometric prompt
  // before seeing the main UI. Skipped entirely for unauthenticated users
  // (the auth flow is the gate in that case) and for devices without
  // enrolled biometrics.
  useEffect(() => {
    if (isHydrating) return;
    if (!isAuthenticated) {
      setBioGate("passed");
      return;
    }
    let cancelled = false;
    (async () => {
      const [enabled, available] = await Promise.all([
        isBiometricEnabled(),
        isBiometricAvailable(),
      ]);
      if (cancelled) return;
      if (!enabled || !available) {
        setBioGate("passed");
        return;
      }
      setBioGate("required");
      const ok = await authenticateWithBiometric("Unlock MySooq");
      if (cancelled) return;
      setBioGate(ok ? "passed" : "required");
    })();
    return () => {
      cancelled = true;
    };
  }, [isHydrating, isAuthenticated]);

  const retryBiometric = async () => {
    const ok = await authenticateWithBiometric("Unlock MySooq");
    if (ok) setBioGate("passed");
  };

  // Connect socket when authenticated AND past the biometric gate; otherwise
  // disconnect so we don't keep a privileged socket open behind a lock.
  // Also wires the notification:new bridge → store and prefetches the unread count.
  useEffect(() => {
    if (isAuthenticated && bioGate === "passed") {
      socketService.connect();
      const unsubNotif = subscribeSocketToStore(dispatch, { notificationReceived });
      const unsubChat = subscribeChatSocketToStore(
        dispatch,
        { chatMessageReceived, chatConversationUpdated },
        () => currentUserIdRef.current,
      );
      dispatch(fetchUnreadCount());
      dispatch(fetchChatUnreadCount());
      dispatch(fetchProfile());
      return () => {
        if (typeof unsubNotif === 'function') unsubNotif();
        if (typeof unsubChat === 'function') unsubChat();
      };
    } else {
      socketService.disconnect();
    }
  }, [isAuthenticated, bioGate, dispatch]);

  // Phase 5 - AppState handling. Backgrounding the app for >60s disconnects
  // the socket (saves battery + server-side resources); foregrounding
  // reconnects and refreshes the unread count.
  useEffect(() => {
    if (!isAuthenticated || bioGate !== "passed") return undefined;

    let backgroundTimer = null;
    let alive = true;
    let prevState = AppState.currentState;

    const sub = AppState.addEventListener("change", (next) => {
      if (prevState !== "background" && next === "background") {
        backgroundTimer = setTimeout(() => {
          try { socketService.disconnect(); } catch (_) {}
        }, 60_000);
      } else if (prevState === "background" && (next === "active" || next === "inactive")) {
        if (backgroundTimer) { clearTimeout(backgroundTimer); backgroundTimer = null; }
        // Rotate the access token before reconnecting. The socket handshake
        // carries a single JWT snapshot, so without this every foreground after
        // the 15-minute expiry failed with "jwt expired" and realtime stayed
        // dead until a full restart.
        ensureFreshAccessToken()
          .catch(() => {})
          .finally(() => {
            if (!alive) return;
            socketService.connect();
            dispatch(fetchUnreadCount());
            dispatch(fetchChatUnreadCount());
          });
      }
      prevState = next;
    });

    return () => {
      alive = false;
      sub.remove();
      if (backgroundTimer) clearTimeout(backgroundTimer);
    };
  }, [isAuthenticated, bioGate, dispatch]);

  // The navigator is ALWAYS mounted (never replaced by a spinner / lock), so a
  // web refresh or an auth re-hydration can't tear down the navigation tree and
  // reset the user to the initial route. Hydration and the biometric lock render
  // as full-screen overlays on top of it instead - React Navigation's web URL
  // sync then restores whatever route the browser was already on.
  const showHydrating = isHydrating;
  const showBiometricLock = !isHydrating && isAuthenticated && bioGate !== "passed";

  const onNavReady = () => {
    // Surface the initial route to socket service so the notification:new
    // toast suppression can read it on the very first render too.
    try {
      const r = navigationRef.current?.getCurrentRoute?.();
      if (r?.name) socketService.setCurrentRouteName(r.name);
    } catch (_) {}

    if (pendingActionRef.current && navigationRef.current?.isReady?.()) {
      const action = pendingActionRef.current;
      pendingActionRef.current = null;
      try { navigationRef.current.navigate(action.name, action.params); } catch (_) {}
    }

    // Fire an order intent that was captured before the navigator was ready
    // (already-authed cold start from a `?intent=` link).
    replayPendingIntent();
  };

  const onNavStateChange = () => {
    try {
      const r = navigationRef.current?.getCurrentRoute?.();
      if (r?.name) socketService.setCurrentRouteName(r.name);
    } catch (_) {}
  };

  return (
    <View style={{ flex: 1 }}>
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      linking={NAV_LINKING}
      onReady={onNavReady}
      onStateChange={onNavStateChange}
    >
      {/*
        Single unconditional stack, not gated on isAuthenticated - this is a
        marketplace, not a walled app: browsing (Home's nested stack hosting
        Shops/VendorStorefront/products, and the MainTabs themselves) must be
        public. Only screens that inherently need to know who you are
        (Chats/Orders/Account tabs, and everything below that's reachable only
        from them) check auth themselves and show a SignInPrompt inline - see
        ChatsScreen/OrdersScreen/ProfileScreen. Login/Register/etc are just
        ordinary reachable screens, navigated to from those prompts or from
        Account, not a startup gate.
      */}
      <Stack.Navigator initialRouteName="MainTabs" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen name="Seller" component={SellerStackNavigator} />

        {/* Auth */}
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="OtpVerification" component={OtpVerificationScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />

        {/* Account (reachable once signed in) */}
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="ProfilePhoto" component={ProfilePhotoScreen} />
        <Stack.Screen name="PhoneCapture" component={PhoneCaptureScreen} />
        <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
        <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
        <Stack.Screen name="Legal" component={LegalScreen} />
        <Stack.Screen
          name="LocationPicker"
          component={LocationPickerScreen}
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />

        {/* Security */}
        <Stack.Screen name="Sessions" component={SessionsScreen} />

        {/* Notifications */}
        <Stack.Screen name="NotificationCenter" component={NotificationCenterScreen} />

        {/* Chat thread - the conversation list lives in ChatsTab */}
        <Stack.Screen name="ChatThread" component={ChatThreadScreen} />

        {/* Order history - reachable from the Account menu (was a bottom tab) */}
        <Stack.Screen name="Orders" component={OrdersScreen} />

        {/* Support - tickets and disputes */}
        <Stack.Screen name="SupportChat" component={SupportChatScreen} />
        <Stack.Screen name="MyTickets" component={MyTicketsScreen} />
        <Stack.Screen name="CreateSupportTicket" component={CreateTicketScreen} />
        <Stack.Screen name="SupportTicketDetail" component={TicketDetailScreen} />
        <Stack.Screen name="CreateDispute" component={CreateDisputeScreen} />
        <Stack.Screen name="SupportDisputeDetail" component={DisputeDetailScreen} />

        {/* Requests (reverse marketplace) + real search */}
        <Stack.Screen name="SearchResults" component={SearchResultsScreen} />
        <Stack.Screen name="RequestCompose" component={RequestComposeScreen} />
        <Stack.Screen name="MyRequests" component={MyRequestsScreen} />
        <Stack.Screen name="RequestDetail" component={RequestDetailScreen} />
      </Stack.Navigator>
    </NavigationContainer>

    {/* Full-screen overlays - the navigator stays mounted underneath so a
        refresh/re-hydration never resets the route. */}
    {showHydrating && (
      <View
        style={{
          ...StyleSheet.absoluteFillObject,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: tokens.bg.canvas,
        }}
      >
        <ActivityIndicator size="large" color={tokens.brand.default} />
      </View>
    )}

    {showBiometricLock && (
      <View
        style={{
          ...StyleSheet.absoluteFillObject,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: tokens.bg.canvas,
          paddingHorizontal: 32,
        }}
      >
        <Ionicons name="finger-print" size={72} color={tokens.brand.default} />
        <Text style={{ marginTop: 24, fontSize: 22, fontWeight: "800", color: tokens.text.primary }}>
          Locked
        </Text>
        <Text
          style={{
            marginTop: 8,
            fontSize: 14,
            color: tokens.text.muted,
            textAlign: "center",
            lineHeight: 20,
          }}
        >
          Authenticate with biometrics to continue.
        </Text>
        <TouchableOpacity
          onPress={retryBiometric}
          style={{
            marginTop: 28,
            backgroundColor: tokens.brand.default,
            paddingVertical: 14,
            paddingHorizontal: 32,
            borderRadius: 14,
          }}
        >
          <Text style={{ color: tokens.text.onBrand, fontWeight: "700", fontSize: 15 }}>
            Use biometrics
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => dispatch(logout())}
          style={{ marginTop: 16, paddingVertical: 10 }}
        >
          <Text style={{ color: tokens.text.muted, fontWeight: "600", fontSize: 14 }}>
            Sign out instead
          </Text>
        </TouchableOpacity>
      </View>
    )}

    <NotificationPermissionBanner />
    </View>
  );
}
