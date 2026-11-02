import React, { useState, useMemo } from "react";
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Modal, Alert, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../theme";
import { useVendorTaxonomy, useVendorId } from "../hooks/useSeller";
import {
  createOwnCategory, updateCategoryMeta, deleteOwnCategory,
  createOwnSubcategory, updateSubcategoryMeta, deleteOwnSubcategory,
} from "../api/vendorApi";
import { pickImage, uploadImage } from "../lib/upload";
import ImageUpload from "../components/ImageUpload";

export default function SellerCategoriesScreen() {
  const { tokens } = useTheme();
  const vendorId = useVendorId();
  const { data, isLoading, refetch } = useVendorTaxonomy();
  const categories = Array.isArray(data) ? data : [];

  const [search, setSearch] = useState("");
  const [scope, setScope] = useState("all");
  const [busy, setBusy] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [catName, setCatName] = useState("");
  const [catImage, setCatImage] = useState(null);
  const [uploadingCat, setUploadingCat] = useState(false);

  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState("");
  const [editImage, setEditImage] = useState(null);
  const [editAck, setEditAck] = useState(false);
  const [uploadingEdit, setUploadingEdit] = useState(false);

  const [editingSub, setEditingSub] = useState(null);
  const [editSubName, setEditSubName] = useState("");
  const [editSubImage, setEditSubImage] = useState(null);
  const [editSubAck, setEditSubAck] = useState(false);
  const [uploadingSub, setUploadingSub] = useState(false);

  const [addingSubFor, setAddingSubFor] = useState(null);
  const [newSubName, setNewSubName] = useState("");

  const global = useMemo(() => categories.filter((c) => !c.owned), [categories]);
  const mine = useMemo(() => categories.filter((c) => c.owned), [categories]);
  const globalNames = useMemo(() => new Set(global.map((c) => (c.name || "").toLowerCase())), [global]);

  const counts = { all: categories.length, yours: mine.length, global: global.length };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categories.filter((c) => {
      if (scope === "yours" && !c.owned) return false;
      if (scope === "global" && c.owned) return false;
      if (!q) return true;
      return (c.name || "").toLowerCase().includes(q) || (c.subcategories || []).some((s) => (s.name || "").toLowerCase().includes(q));
    });
  }, [categories, scope, search]);

  const createClash = catName.trim() ? globalNames.has(catName.trim().toLowerCase()) : false;

  const submitCreate = async () => {
    const name = catName.trim();
    if (!name || createClash) return;
    setBusy(true);
    try {
      await createOwnCategory(vendorId, { name, imageUrl: catImage });
      setShowCreate(false);
      setCatName("");
      setCatImage(null);
      await refetch();
    } catch (e) {}
    finally { setBusy(false); }
  };

  const openEdit = (category) => {
    setEditing(category);
    setEditName(category.name || "");
    setEditImage(category.imageUrl || null);
    setEditAck(false);
  };

  const submitEdit = async () => {
    if (!editing) return;
    const imageChanged = editImage !== editing.imageUrl;
    if (!editing.owned && imageChanged && !editAck) return;
    setBusy(true);
    try {
      const input = { imageUrl: editImage };
      if (editing.owned) input.name = editName.trim();
      await updateCategoryMeta(vendorId, editing.id, input);
      setEditing(null);
      await refetch();
    } catch (e) {}
    finally { setBusy(false); }
  };

  const confirmRemove = (category) => {
    Alert.alert("Remove category", `Remove "${category.name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        setBusy(true);
        try { await deleteOwnCategory(vendorId, category.id); await refetch(); } catch (e) {}
        finally { setBusy(false); }
      } },
    ]);
  };

  const openEditSub = (category, sub) => {
    setEditingSub({ category, sub });
    setEditSubName(sub.name || "");
    setEditSubImage(sub.imageUrl || null);
    setEditSubAck(false);
  };

  const submitEditSub = async () => {
    if (!editingSub) return;
    const imageChanged = editSubImage !== editingSub.sub.imageUrl;
    if (!editingSub.sub.owned && imageChanged && !editSubAck) return;
    setBusy(true);
    try {
      const input = { imageUrl: editSubImage };
      if (editingSub.sub.owned) input.name = editSubName.trim();
      await updateSubcategoryMeta(vendorId, editingSub.category.id, editingSub.sub.id, input);
      setEditingSub(null);
      await refetch();
    } catch (e) {}
    finally { setBusy(false); }
  };

  const submitAddSub = async (categoryId) => {
    if (!newSubName.trim()) return;
    setBusy(true);
    try {
      await createOwnSubcategory(vendorId, categoryId, { name: newSubName.trim() });
      setNewSubName("");
      setAddingSubFor(null);
      await refetch();
    } catch (e) {}
    finally { setBusy(false); }
  };

  const confirmRemoveSub = (category, sub) => {
    Alert.alert("Remove subcategory", `Remove "${sub.name}" from "${category.name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        setBusy(true);
        try { await deleteOwnSubcategory(vendorId, category.id, sub.id); await refetch(); } catch (e) {}
        finally { setBusy(false); }
      } },
    ]);
  };

  const uploadImageFor = async (setter, setUploading) => {
    const asset = await pickImage();
    if (!asset) return;
    setUploading(true);
    try { const url = await uploadImage(asset, "category"); setter(url); } catch (e) {}
    finally { setUploading(false); }
  };

  const renderThumb = (url, size = 40) => (
    <View style={{ width: size, height: size, borderRadius: 10, backgroundColor: tokens.bg.surfaceMuted, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
      {url ? <Image source={{ uri: url }} style={{ width: size, height: size }} /> : <Text style={{ color: tokens.text.muted, fontSize: 10 }}>No img</Text>}
    </View>
  );

  
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <ScrollView
        style={{ width: "100%", maxWidth: 960, alignSelf: "center" }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refetch()} tintColor={tokens.brand.default} />}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <TouchableOpacity onPress={() => { setShowCreate(true); setCatName(""); setCatImage(null); }} style={{ backgroundColor: tokens.brand.default, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}>
            <Text style={{ color: tokens.text.onBrand, fontWeight: "700" }}>+ New</Text>
          </TouchableOpacity>
        </View>

        <TextInput value={search} onChangeText={setSearch} placeholder="Search categories..." placeholderTextColor={tokens.text.placeholder} style={{ backgroundColor: tokens.bg.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: tokens.text.primary, borderWidth: 1, borderColor: tokens.border.default, marginBottom: 10 }} />

        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          {["all", "yours", "global"].map((s) => (
            <TouchableOpacity key={s} onPress={() => setScope(s)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: scope === s ? tokens.brand.default : tokens.bg.surfaceMuted }}>
              <Text style={{ color: scope === s ? tokens.text.onBrand : tokens.text.primary, fontWeight: "600", fontSize: 12 }}>{s} ({counts[s]})</Text>
            </TouchableOpacity>
          ))}
        </View>

        {filtered.length === 0 ? (
          <Text style={{ color: tokens.text.muted, textAlign: "center", marginTop: 20 }}>No categories</Text>
        ) : filtered.map((c) => (
          <View key={c.id} style={{ backgroundColor: tokens.bg.surface, borderRadius: 14, borderWidth: 1, borderColor: tokens.border.default, padding: 12, marginBottom: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              {renderThumb(c.imageUrl, 44)}
              <View style={{ flex: 1 }}>
                <Text style={{ color: tokens.text.primary, fontWeight: "700" }}>{c.name}</Text>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: c.owned ? tokens.brand.default : tokens.text.muted, backgroundColor: c.owned ? tokens.brand.soft : tokens.bg.surfaceMuted, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                    {c.owned ? "Yours" : "Global"}
                  </Text>
                  <Text style={{ color: tokens.text.muted, fontSize: 11 }}>{c.subcategories?.length || 0} subs · {c.productCount || 0} products</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => openEdit(c)} style={{ padding: 6 }}>
                <Text style={{ color: tokens.text.muted, fontWeight: "600", fontSize: 12 }}>Edit</Text>
              </TouchableOpacity>
              {c.owned ? (
                <TouchableOpacity onPress={() => confirmRemove(c)} style={{ padding: 6 }}>
                  <Text style={{ color: tokens.status.error, fontWeight: "600", fontSize: 12 }}>Delete</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {(c.subcategories || []).map((s) => (
              <View key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, marginLeft: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: tokens.border.subtle }}>
                {renderThumb(s.imageUrl, 32)}
                <Text style={{ flex: 1, color: tokens.text.primary, fontSize: 13 }}>{s.name}</Text>
                <Text style={{ fontSize: 9, fontWeight: "700", color: s.owned ? tokens.brand.default : tokens.text.muted, backgroundColor: s.owned ? tokens.brand.soft : tokens.bg.surfaceMuted, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 }}>
                  {s.owned ? "Yours" : "Global"}
                </Text>
                <TouchableOpacity onPress={() => openEditSub(c, s)} style={{ padding: 4 }}>
                  <Text style={{ color: tokens.text.muted, fontSize: 11, fontWeight: "600" }}>Edit</Text>
                </TouchableOpacity>
                {s.owned ? (
                  <TouchableOpacity onPress={() => confirmRemoveSub(c, s)} style={{ padding: 4 }}>
                    <Text style={{ color: tokens.status.error, fontSize: 11, fontWeight: "600" }}>Del</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}

            {addingSubFor === c.id ? (
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8, marginLeft: 8 }}>
                <TextInput value={newSubName} onChangeText={setNewSubName} placeholder="Subcategory name" placeholderTextColor={tokens.text.placeholder} style={{ flex: 1, backgroundColor: tokens.bg.surfaceMuted, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: tokens.text.primary }} />
                <TouchableOpacity onPress={() => submitAddSub(c.id)} disabled={busy} style={{ backgroundColor: tokens.brand.default, paddingHorizontal: 10, borderRadius: 8, justifyContent: "center", opacity: busy ? 0.7 : 1 }}>
                  <Text style={{ color: tokens.text.onBrand, fontWeight: "700", fontSize: 12 }}>Add</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setAddingSubFor(null); setNewSubName(""); }} style={{ paddingHorizontal: 8, justifyContent: "center" }}>
                  <Text style={{ color: tokens.text.muted, fontSize: 12 }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={() => setAddingSubFor(c.id)} style={{ marginTop: 8, marginLeft: 8 }}>
                <Text style={{ color: tokens.brand.default, fontWeight: "600", fontSize: 12 }}>+ Add subcategory</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: tokens.bg.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, maxHeight: "80%" }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: tokens.text.primary, marginBottom: 12 }}>New category</Text>
              <TextInput value={catName} onChangeText={setCatName} placeholder="Category name" placeholderTextColor={tokens.text.placeholder} style={{ backgroundColor: tokens.bg.surfaceMuted, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: tokens.text.primary, marginBottom: 10, borderWidth: 1, borderColor: createClash ? tokens.status.error : tokens.border.default }} />
              {createClash ? <Text style={{ color: tokens.status.error, fontSize: 12, marginBottom: 8 }}>Name clashes with a global category</Text> : null}
              <ImageUpload value={catImage} onChange={(url) => setCatImage(url || null)} kind="category" containerStyle={{ height: 120, width: "100%" }} />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity onPress={() => setShowCreate(false)} style={{ flex: 1, backgroundColor: tokens.bg.surfaceMuted, paddingVertical: 12, borderRadius: 10, alignItems: "center" }}>
                  <Text style={{ color: tokens.text.primary, fontWeight: "700" }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={submitCreate} disabled={busy || uploadingCat || !catName.trim() || createClash} style={{ flex: 1, backgroundColor: tokens.brand.default, paddingVertical: 12, borderRadius: 10, alignItems: "center", opacity: busy || uploadingCat || !catName.trim() || createClash ? 0.7 : 1 }}>
                  <Text style={{ color: tokens.text.onBrand, fontWeight: "700" }}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: tokens.bg.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, maxHeight: "80%" }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: tokens.text.primary, marginBottom: 12 }}>Edit category</Text>
              <TextInput value={editName} onChangeText={setEditName} editable={!!editing?.owned} placeholder="Category name" placeholderTextColor={tokens.text.placeholder} style={{ backgroundColor: tokens.bg.surfaceMuted, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: editing?.owned ? tokens.text.primary : tokens.text.muted, marginBottom: 10, borderWidth: 1, borderColor: tokens.border.default }} />
              <ImageUpload value={editImage} onChange={(url) => setEditImage(url || null)} kind="category" containerStyle={{ height: 120, width: "100%" }} />
              {!editing?.owned && editImage !== editing?.imageUrl ? (
                <View style={{ backgroundColor: tokens.status.warningSoft, padding: 10, borderRadius: 10, marginBottom: 12 }}>
                  <Text style={{ color: tokens.status.warningStrong, fontSize: 12, marginBottom: 6 }}>You are changing a shared (global) category image. This affects everyone.</Text>
                  <TouchableOpacity onPress={() => setEditAck(!editAck)} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: tokens.border.default, alignItems: "center", justifyContent: "center", backgroundColor: editAck ? tokens.brand.default : "transparent" }}>
                      {editAck ? <Text style={{ color: tokens.text.onBrand, fontSize: 12, fontWeight: "800" }}>✓</Text> : null}
                    </View>
                    <Text style={{ color: tokens.status.warningStrong, fontSize: 12 }}>I understand</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity onPress={() => setEditing(null)} style={{ flex: 1, backgroundColor: tokens.bg.surfaceMuted, paddingVertical: 12, borderRadius: 10, alignItems: "center" }}>
                  <Text style={{ color: tokens.text.primary, fontWeight: "700" }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={submitEdit} disabled={busy || uploadingEdit || (!editing?.owned && (editImage !== editing?.imageUrl) && !editAck)} style={{ flex: 1, backgroundColor: tokens.brand.default, paddingVertical: 12, borderRadius: 10, alignItems: "center", opacity: busy || uploadingEdit ? 0.7 : 1 }}>
                  <Text style={{ color: tokens.text.onBrand, fontWeight: "700" }}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={!!editingSub} transparent animationType="slide" onRequestClose={() => setEditingSub(null)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: tokens.bg.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, maxHeight: "80%" }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: tokens.text.primary, marginBottom: 12 }}>Edit subcategory</Text>
              <TextInput value={editSubName} onChangeText={setEditSubName} editable={!!editingSub?.sub?.owned} placeholder="Subcategory name" placeholderTextColor={tokens.text.placeholder} style={{ backgroundColor: tokens.bg.surfaceMuted, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: editingSub?.sub?.owned ? tokens.text.primary : tokens.text.muted, marginBottom: 10, borderWidth: 1, borderColor: tokens.border.default }} />
              <ImageUpload value={editSubImage} onChange={(url) => setEditSubImage(url || null)} kind="category" containerStyle={{ height: 100, width: "100%" }} />
              {!editingSub?.sub?.owned && editSubImage !== editingSub?.sub?.imageUrl ? (
                <View style={{ backgroundColor: tokens.status.warningSoft, padding: 10, borderRadius: 10, marginBottom: 12 }}>
                  <Text style={{ color: tokens.status.warningStrong, fontSize: 12, marginBottom: 6 }}>You are changing a shared (global) subcategory image.</Text>
                  <TouchableOpacity onPress={() => setEditSubAck(!editSubAck)} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: tokens.border.default, alignItems: "center", justifyContent: "center", backgroundColor: editSubAck ? tokens.brand.default : "transparent" }}>
                      {editSubAck ? <Text style={{ color: tokens.text.onBrand, fontSize: 12, fontWeight: "800" }}>✓</Text> : null}
                    </View>
                    <Text style={{ color: tokens.status.warningStrong, fontSize: 12 }}>I understand</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity onPress={() => setEditingSub(null)} style={{ flex: 1, backgroundColor: tokens.bg.surfaceMuted, paddingVertical: 12, borderRadius: 10, alignItems: "center" }}>
                  <Text style={{ color: tokens.text.primary, fontWeight: "700" }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={submitEditSub} disabled={busy || uploadingSub || (!editingSub?.sub?.owned && (editSubImage !== editingSub?.sub?.imageUrl) && !editSubAck)} style={{ flex: 1, backgroundColor: tokens.brand.default, paddingVertical: 12, borderRadius: 10, alignItems: "center", opacity: busy || uploadingSub ? 0.7 : 1 }}>
                  <Text style={{ color: tokens.text.onBrand, fontWeight: "700" }}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}