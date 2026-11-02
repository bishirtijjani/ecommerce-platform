/**
 * savedItemsSlice - customer's saved/interested listings, persisted to
 * AsyncStorage. Powers the Cart tab, which stands in permanently for both
 * "cart" and "saved" - this marketplace is chat-commerce (see
 * ContactVendorSheet), so this is a wishlist, not a real cart.
 *
 * Replaces the old single-merchant `cartSlice` (quantities, line totals,
 * merchant-binding) - none of that applies without a checkout flow.
 */

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { logout } from "./authSlice";

const STORAGE_KEY = "savedItems:v1";

export const hydrateSavedItemsFromStorage = createAsyncThunk(
  "savedItems/hydrate",
  async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
);

const persist = (items) => {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() => {});
};

const savedItemsSlice = createSlice({
  name: "savedItems",
  initialState: { items: [] },
  reducers: {
    // item: { id, title, price, image } - enough to render the Cart tab
    // without a product-fetch round-trip.
    toggleSaved: (state, action) => {
      const item = action.payload;
      const idx = state.items.findIndex((i) => i.id === item.id);
      if (idx >= 0) {
        state.items.splice(idx, 1);
      } else {
        state.items.push(item);
      }
      persist(state.items);
    },
    removeSaved: (state, action) => {
      state.items = state.items.filter((i) => i.id !== action.payload);
      persist(state.items);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(hydrateSavedItemsFromStorage.fulfilled, (state, action) => {
        state.items = action.payload || [];
      })
      .addCase(logout.fulfilled, (state) => {
        state.items = [];
      });
  },
});

export const { toggleSaved, removeSaved } = savedItemsSlice.actions;
export const selectIsSaved = (id) => (state) =>
  state.savedItems.items.some((i) => i.id === id);
export default savedItemsSlice.reducer;
