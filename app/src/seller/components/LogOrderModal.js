import React, { useState, useMemo } from "react";
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { useTheme } from "../../theme";
import { useVendorProducts, useLogOrder, useVendorId } from "../hooks/useSeller";
import { formatNaira } from "../../data/marketplace";
import api from "../../services/api";

export default function LogOrderModal({ open, onClose }) {
  const { tokens } = useTheme();
  const vendorId = useVendorId();
  const { data: productsPage } = useVendorProducts();
  const logOrder = useLogOrder();
  const products = productsPage?.data || productsPage?.products || (Array.isArray(productsPage) ? productsPage : []);

  const [phone, setPhone] = useState("");
  const [matches, setMatches] = useState([]);
  const [searching, setSearching] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [newAddress, setNewAddress] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [items, setItems] = useState([]);

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    const available = products.filter((p) => p.isAvailable !== false);
    if (!q) return available.slice(0, 8);
    return available.filter((p) => p.name?.toLowerCase().includes(q)).slice(0, 8);
  }, [products, productQuery]);

  const searchCustomers = async (value) => {
    if (value.replace(/\D/g, "").length < 6) {
      setMatches([]);
      return;
    }
    setSearching(true);
    try {
      const res = await api.get(`/vendors/vendor/${null}/customers`.replace("/null", ""), { params: { phone: value } }).catch(() => null);
      // fallback: try searchCustomers endpoint
    } catch (e) {}
    finally { setSearching(false); }
  };

  const doSearch = async (value) => {
    setPhone(value);
    if (value.replace(/\D/g, "").length < 6 || customer) {
      setMatches([]);
      return;
    }
    setSearching(true);
    try {
      const res = await api.get(`/vendors/vendor/${vendorId}/customers`, { params: { phone: value } });
      const data = res?.data || res;
      setMatches(Array.isArray(data) ? data : data?.data || []);
    } catch (e) {
      setMatches([]);
    } finally {
      setSearching(false);
    }
  };

  const addItem = (product, variant) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.variant.id === variant.id);
      if (existing) return prev.map((i) => (i.variant.id === variant.id ? { ...i, quantity: i.quantity + 1 } : i));
      return [...prev, { key: variant.id, product, variant, quantity: 1 }];
    });
  };

  const setQty = (variantId, qty) => {
    setItems((prev) =>
      prev.map((i) => (i.variant.id === variantId ? { ...i, quantity: Math.max(1, qty) } : i)).filter((i) => i.quantity > 0)
    );
  };

  const removeItem = (variantId) => setItems((prev) => prev.filter((i) => i.variant.id !== variantId));

  const total = items.reduce((sum, i) => sum + (i.variant.price || 0) * i.quantity, 0);

  const reset = () => {
    setPhone("");
    setCustomer(null);
    setNewAddress("");
    setProductQuery("");
    setItems([]);
    setMatches([]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const canSubmit = !!customer && (newAddress.trim().length >= 5) && items.length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    logOrder.mutate(
      {
        customerId: customer.id,
        newAddress: { address: newAddress.trim() },
        items: items.map((i) => ({ productId: i.product.id, variantId: i.variant.id, quantity: i.quantity })),
      },
      { onSuccess: handleClose }
    );
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: tokens.bg.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, maxHeight: "90%" }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: tokens.text.primary, marginBottom: 12 }}>Log order</Text>
          <ScrollView>
            {!customer ? (
              <View style={{ marginBottom: 12 }}>
                <TextInput
                  value={phone}
                  onChangeText={doSearch}
                  placeholder="Customer phone"
                  placeholderTextColor={tokens.text.placeholder}
                  style={{ backgroundColor: tokens.bg.surfaceMuted, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: tokens.text.primary, borderWidth: 1, borderColor: tokens.border.default, marginBottom: 8 }}
                />
                {searching ? <ActivityIndicator color={tokens.brand.default} /> : null}
                {matches.map((m) => (
                  <TouchableOpacity key={m.id} onPress={() => setCustomer(m)} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tokens.border.default }}>
                    <Text style={{ color: tokens.text.primary, fontWeight: "600" }}>{m.firstName} {m.lastName}</Text>
                    <Text style={{ color: tokens.text.muted, fontSize: 12 }}>{m.phone}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: tokens.text.primary, fontWeight: "700" }}>{customer.firstName} {customer.lastName}</Text>
                <Text style={{ color: tokens.text.muted, fontSize: 12, marginBottom: 8 }}>{customer.phone}</Text>
                <TouchableOpacity onPress={() => { setCustomer(null); setMatches([]); }}>
                  <Text style={{ color: tokens.brand.default, fontWeight: "600", fontSize: 12 }}>Change customer</Text>
                </TouchableOpacity>
              </View>
            )}

            {customer ? (
              <View style={{ marginBottom: 12 }}>
                <TextInput
                  value={newAddress}
                  onChangeText={setNewAddress}
                  placeholder="Delivery address"
                  placeholderTextColor={tokens.text.placeholder}
                  multiline
                  style={{ backgroundColor: tokens.bg.surfaceMuted, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: tokens.text.primary, borderWidth: 1, borderColor: tokens.border.default, minHeight: 60 }}
                />
              </View>
            ) : null}

            {customer ? (
              <View style={{ marginBottom: 12 }}>
                <TextInput
                  value={productQuery}
                  onChangeText={setProductQuery}
                  placeholder="Search products"
                  placeholderTextColor={tokens.text.placeholder}
                  style={{ backgroundColor: tokens.bg.surfaceMuted, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: tokens.text.primary, borderWidth: 1, borderColor: tokens.border.default, marginBottom: 8 }}
                />
                {filteredProducts.map((p) =>
                  (p.variants || [{ id: p.id, price: p.basePrice }]).map((v) => (
                    <TouchableOpacity key={v.id} onPress={() => addItem(p, v)} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: tokens.border.subtle }}>
                      <Text style={{ color: tokens.text.primary, fontWeight: "600", flex: 1 }}>{p.name}</Text>
                      <Text style={{ color: tokens.text.muted, fontSize: 12 }}>{formatNaira(v.price || p.basePrice)}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            ) : null}

            {items.length > 0 ? (
              <View style={{ marginBottom: 12 }}>
                {items.map((i) => (
                  <View key={i.key} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: tokens.border.subtle }}>
                    <Text style={{ color: tokens.text.primary, fontWeight: "600", flex: 1 }}>{i.product.name}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <TouchableOpacity onPress={() => setQty(i.variant.id, i.quantity - 1)}>
                        <Text style={{ color: tokens.brand.default, fontWeight: "700", fontSize: 16 }}>-</Text>
                      </TouchableOpacity>
                      <Text style={{ color: tokens.text.primary, fontWeight: "700", width: 20, textAlign: "center" }}>{i.quantity}</Text>
                      <TouchableOpacity onPress={() => setQty(i.variant.id, i.quantity + 1)}>
                        <Text style={{ color: tokens.brand.default, fontWeight: "700", fontSize: 16 }}>+</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={() => removeItem(i.variant.id)} style={{ marginLeft: 8 }}>
                      <Text style={{ color: tokens.status.error, fontWeight: "600", fontSize: 12 }}>X</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <Text style={{ color: tokens.text.primary, fontWeight: "800", marginTop: 8 }}>Total: {formatNaira(total)}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <TouchableOpacity onPress={handleClose} style={{ flex: 1, backgroundColor: tokens.bg.surfaceMuted, paddingVertical: 12, borderRadius: 10, alignItems: "center" }}>
              <Text style={{ color: tokens.text.primary, fontWeight: "700" }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSubmit} disabled={!canSubmit || logOrder.isPending} style={{ flex: 1, backgroundColor: tokens.brand.default, paddingVertical: 12, borderRadius: 10, alignItems: "center", opacity: !canSubmit || logOrder.isPending ? 0.7 : 1 }}>
              <Text style={{ color: tokens.text.onBrand, fontWeight: "700" }}>{logOrder.isPending ? "Saving..." : "Log order"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}