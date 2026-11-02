import AsyncStorage from "@react-native-async-storage/async-storage";
import { combineReducers, configureStore } from "@reduxjs/toolkit";
import authReducer, { forceLogout as forceLogoutAction, logout } from "./slices/authSlice";
import profileReducer from "./slices/profileSlice";
import locationReducer from "./slices/locationSlice";
import categoriesReducer from "./slices/categoriesSlice";
import settingsReducer from "./slices/settingsSlice";
import notificationsReducer from "./slices/notificationsSlice";
import savedItemsReducer from "./slices/savedItemsSlice";
import supportReducer from "./slices/supportSlice";
import marketplaceReducer from "./slices/marketplaceSlice";
import chatReducer from "./slices/chatSlice";
import requestReducer from "./slices/requestSlice";
import * as SecureStore from "../lib/storage";
import { registerForceLogout } from "../services/api";

const combined = combineReducers({
  auth: authReducer,
  profile: profileReducer,
  location: locationReducer,
  categories: categoriesReducer,
  settings: settingsReducer,
  notifications: notificationsReducer,
  savedItems: savedItemsReducer,
  support: supportReducer,
  marketplace: marketplaceReducer,
  chat: chatReducer,
  request: requestReducer,
});

// Root reducer with logout passthrough. Wipes ALL user-scoped state on
// EITHER logout path so the next user that signs in on the same device
// doesn't see the previous user's data: `forceLogout` (silent token-refresh
// failure) and the normal `auth/logout` (the account's own "Log Out" button)
// both need this - only wiring the former left every voluntary logout
// leaking the outgoing user's state into whoever logged in next on that
// device. `categories`, `settings`, and `location` are global/anonymous - we
// keep them to avoid an extra cold-load. `savedItems` is user-scoped and
// belongs to whoever signed in; we wipe it AND clear the persisted blob so
// the next user doesn't inherit it on cold start.
const rootReducer = (state, action) => {
  if (forceLogoutAction.match(action) || logout.fulfilled.match(action)) {
    AsyncStorage.removeItem("savedItems:v1").catch(() => {});
    SecureStore.deleteItemAsync("authLastUser").catch(() => {});
    state = {
      categories: state?.categories,
      settings: state?.settings,
      location: state?.location,
      marketplace: state?.marketplace,
    };
  }
  return combined(state, action);
};

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

// services/api.js can't import the store (circular), so it calls back here when
// a refresh token is genuinely dead. Without this, the interceptor cleared the
// tokens but Redux still reported an authenticated user - every subsequent
// request failed with "session expired" until the next cold start.
registerForceLogout(() => store.dispatch(forceLogoutAction()));
