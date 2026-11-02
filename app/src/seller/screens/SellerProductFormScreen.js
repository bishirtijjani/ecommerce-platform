import React, { useState, useEffect, useMemo } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Switch, ActivityIndicator, SafeAreaView, Alert } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import FormInput from "../../components/FormInput";
import SearchableSelect from "../../components/SearchableSelect";
import { useTheme } from "../../theme";
import { useProduct, useCreateProduct, useUpdateProduct, useVendorTaxonomy, useCreateVariant, useUpdateVariant, useDeleteVariant, useVendorId } from "../hooks/useSeller";
import { bulkUpsertOptionGroups } from "../api/vendorApi";
import { pickImage, pickVideo, uploadImage } from "../lib/upload";
import OptionGroupsEditor, { buildOptionGroupsPayload } from "./OptionGroupsEditor";
import StickySaveBar from "../components/StickySaveBar";
import ImageUpload from "../components/ImageUpload";
import { useUnsavedChangesGuard } from "../hooks/useUnsavedChangesGuard";

export default function SellerProductFormScreen() {
  const { tokens } = useTheme();
  const route = useRoute();
  const navigation = useNavigation();
  const productId = route.params?.productId;
  const vendorId = useVendorId();
  const { data: product } = useProduct(productId);
  const { data: categories } = useVendorTaxonomy();
  const create = useCreateProduct();
  const update = useUpdateProduct(productId);
  const createVariant = useCreateVariant(productId);
  const updateVariant = useUpdateVariant(productId);
  const deleteVariant = useDeleteVariant(productId);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [stock, setStock] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [condition, setCondition] = useState("NEW");
  const [images, setImages] = useState([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [variants, setVariants] = useState([]);
  const [groups, setGroups] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (product) {
      setName(product.name || "");
      setDescription(product.description || "");
      setBasePrice(String(product.basePrice ?? ""));
      setCategoryId(product.categoryId || "");
      setSubcategoryId(product.subcategoryId || "");
      setStock(String(product.stock ?? ""));
      const imgs = product.images && product.images.length > 0 ? product.images : product.imageUrl ? [product.imageUrl] : [];
      setImages(imgs);
      setVideoUrl(product.videoUrl || "");
      setIsAvailable(product.isAvailable !== false);
      setCondition(product.condition || "NEW");
      setVariants((product.variants || []).filter((v) => Object.keys(v.attributes || {}).length > 0).map((v) => ({
        key: v.id || `v-${Date.now()}`,
        id: v.id,
        sku: v.sku || "",
        attributesText: Object.entries(v.attributes || {}).map(([k, val]) => `${k}: ${val}`).join(", "),
        packSize: v.packSize ? String(v.packSize) : "",
        packUnit: v.packUnit || "",
        packLabel: v.packLabel || "",
        price: String(v.price ?? ""),
        stock: String(v.stock ?? ""),
        imageUrl: v.imageUrl || "",
        images: v.images || [],
        videoUrl: v.videoUrl || "",
        isAvailable: v.isAvailable !== false,
      })));
      setGroups((product.optionGroups || []).map((g) => ({
        key: g.id,
        id: g.id,
        name: g.name || "",
        selectionRule: g.selectionRule || "OPTIONAL_ONE",
        maxSelect: g.maxSelect || 1,
        items: (g.items || []).map((i) => ({
          key: i.id,
          id: i.id,
          name: i.name || "",
          priceDelta: String(i.priceDelta ?? 0),
          isDefault: i.isDefault !== false,
          isAvailable: i.isAvailable !== false,
        })),
      })));
    }
  }, [product]);

  const catOptions = (categories || []).map((c) => c.name || c.id);
  const catMap = (categories || []).reduce((acc, c) => ({ ...acc, [c.name || c.id]: c.id }), {});
  const catNameById = (categories || []).reduce((acc, c) => ({ ...acc, [c.id]: c.name || c.id }), {});
  const selectedCat = (categories || []).find((c) => c.id === categoryId);
  const subOptions = (selectedCat?.subcategories || []).map((s) => s.name || s.id);
  const subMap = (selectedCat?.subcategories || []).reduce((acc, s) => ({ ...acc, [s.name || s.id]: s.id }), {});
  const subNameById = (selectedCat?.subcategories || []).reduce((acc, s) => ({ ...acc, [s.id]: s.name || s.id }), {});

  const parseAttributes = (text) => {
    const out = {};
    String(text || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((pair) => {
        const [k, ...rest] = pair.split(":");
        if (k && rest.length) out[k.trim()] = rest.join(":").trim();
      });
    return out;
  };

  const variantPayload = (v) => ({
    sku: v.sku || undefined,
    attributes: parseAttributes(v.attributesText),
    packSize: v.packSize ? Number(v.packSize) : undefined,
    packUnit: v.packUnit || undefined,
    packLabel: v.packLabel || undefined,
    price: Number(v.price) || 0,
    stock: Math.max(0, Math.floor(Number(v.stock) || 0)),
    imageUrl: v.imageUrl || undefined,
    images: v.images && v.images.length ? v.images : undefined,
    videoUrl: v.videoUrl || undefined,
    isAvailable: v.isAvailable !== false,
  });

  const reconcileVariants = async () => {
    const original = product?.variants || [];
    const originalIds = new Set(original.map((v) => v.id));
    const draftIds = new Set(variants.filter((v) => v.id).map((v) => v.id));

    for (const v of variants) {
      const payload = variantPayload(v);
      if (!v.price) continue;
      if (v.id) await updateVariant.mutateAsync({ variantId: v.id, input: payload });
      else await createVariant.mutateAsync(payload);
    }

    if ((original.length || 0) > 1) {
      for (const id of originalIds) {
        if (!draftIds.has(id)) await deleteVariant.mutateAsync(id).catch(() => {});
      }
    }
  };

  const uploadImageFile = async () => {
    const asset = await pickImage();
    if (!asset) return;
    setUploading(true);
    try {
      const url = await uploadImage(asset, "product");
      setImages((prev) => [...prev, url].slice(0, 5));
    } catch (e) {}
    finally { setUploading(false); }
  };

  const uploadVideoFile = async () => {
    const asset = await pickVideo();
    if (!asset) return;
    setUploading(true);
    try {
      const url = await uploadImage(asset, "product");
      setVideoUrl(url);
    } catch (e) {}
    finally { setUploading(false); }
  };

  const makeCover = (index) => {
    setImages((prev) => {
      const next = [...prev];
      const [it] = next.splice(index, 1);
      next.unshift(it);
      return next;
    });
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const submit = async () => {
    const base = {
      name: name.trim(),
      description: description.trim() || undefined,
      basePrice: Number(basePrice) || 0,
      categoryId: catMap[categoryId] || categoryId,
      subcategoryId: (subMap[subcategoryId] || subcategoryId) || undefined,
      stock: Math.max(0, Math.floor(Number(stock) || 0)),
      images: images.length ? images : undefined,
      imageUrl: images[0] || undefined,
      videoUrl: videoUrl || undefined,
      isAvailable,
      condition,
    };
    if (!base.name || !base.categoryId) return;
    setBusy(true);
    try {
      if (productId) {
        await update.mutateAsync(base);
        await reconcileVariants();
        await bulkUpsertOptionGroups(vendorId, productId, buildOptionGroupsPayload(groups));
      } else {
        await create.mutateAsync({
          ...base,
          variants: variants.length ? variants.map(variantPayload) : undefined,
          optionGroups: buildOptionGroupsPayload(groups),
        });
      }
      setSaved(true);
      navigation.goBack();
    } catch (e) {}
    finally { setBusy(false); }
  };

  const dirty = useMemo(() => {
    if (saved) return false;
    if (!product) {
      return !!(name.trim() || description.trim() || basePrice || images.length || variants.length);
    }
    const imgs = product.images && product.images.length > 0 ? product.images : product.imageUrl ? [product.imageUrl] : [];
    return (
      name !== (product.name || "") ||
      description !== (product.description || "") ||
      basePrice !== String(product.basePrice ?? "") ||
      categoryId !== (product.categoryId || "") ||
      subcategoryId !== (product.subcategoryId || "") ||
      stock !== String(product.stock ?? "") ||
      isAvailable !== (product.isAvailable !== false) ||
      condition !== (product.condition || "NEW") ||
      videoUrl !== (product.videoUrl || "") ||
      JSON.stringify(images) !== JSON.stringify(imgs) ||
      JSON.stringify(variants) !== JSON.stringify(product.variants || [])
    );
  }, [name, description, basePrice, categoryId, subcategoryId, stock, isAvailable, condition, videoUrl, images, variants, product, saved]);

  const { showExitConfirm, cancelExit, confirmExit } = useUnsavedChangesGuard(dirty);

  useEffect(() => {
    if (!showExitConfirm) return;
    Alert.alert("Unsaved changes", "Discard your changes?", [
      { text: "Cancel", onPress: cancelExit },
      { text: "Discard", style: "destructive", onPress: confirmExit },
    ]);
  }, [showExitConfirm, cancelExit, confirmExit]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <ScrollView
        style={{ width: "100%", maxWidth: 760, alignSelf: "center" }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 10 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: tokens.bg.surfaceMuted, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="arrow-back" size={18} color={tokens.text.primary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 24, fontWeight: "900", color: tokens.text.primary }}>Product</Text>
        </View>

        <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 16, borderWidth: 1, borderColor: tokens.border.default, padding: 14, marginBottom: 12 }}>
          <Text style={{ fontSize: 13, fontWeight: "800", color: tokens.text.primary, marginBottom: 10 }}>Basic info</Text>
          <FormInput label="Name" value={name} onChangeText={setName} />
          <FormInput label="Description" value={description} onChangeText={setDescription} multiline />
          <SearchableSelect
            label="Category"
            value={catNameById[categoryId] || categoryId}
            onSelect={(n) => { setCategoryId(catMap[n] || n); setSubcategoryId(""); }}
            options={catOptions}
          />
          {selectedCat && (selectedCat.subcategories || []).length > 0 ? (
            <SearchableSelect
              label="Subcategory"
              value={subNameById[subcategoryId] || subcategoryId}
              onSelect={(n) => setSubcategoryId(subMap[n] || n)}
              options={subOptions}
            />
          ) : null}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <FormInput label="Base price" value={basePrice} onChangeText={setBasePrice} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <FormInput label="Stock" value={stock} onChangeText={setStock} keyboardType="numeric" />
            </View>
          </View>
          <Text style={{ color: tokens.text.primary, fontWeight: "700", marginBottom: 8 }}>Condition</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
            {["NEW", "USED", "SECOND_HAND"].map((c) => (
              <TouchableOpacity key={c} onPress={() => setCondition(c)} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: condition === c ? tokens.brand.default : tokens.bg.surfaceMuted }}>
                <Text style={{ color: condition === c ? tokens.text.onBrand : tokens.text.primary, fontWeight: "600", fontSize: 12 }}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: tokens.text.primary, fontWeight: "600" }}>Available</Text>
            <Switch value={isAvailable} onValueChange={setIsAvailable} trackColor={{ true: tokens.brand.default }} />
          </View>
        </View>

        <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 16, borderWidth: 1, borderColor: tokens.border.default, padding: 14, marginBottom: 12 }}>
          <Text style={{ fontSize: 13, fontWeight: "800", color: tokens.text.primary, marginBottom: 10 }}>Photos</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
            {images.map((img, i) => (
              <View key={img + i} style={{ width: 96, height: 96, borderRadius: 10, overflow: "hidden", backgroundColor: tokens.bg.surfaceMuted, position: "relative" }}>
                <Image source={{ uri: img }} style={{ width: 96, height: 96 }} />
                {i === 0 ? (
                  <View style={{ position: "absolute", left: 4, top: 4, backgroundColor: tokens.brand.default, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 2 }}>
                    <Text style={{ color: tokens.text.onBrand, fontSize: 9, fontWeight: "700" }}>Cover</Text>
                  </View>
                ) : null}
                <View style={{ position: "absolute", right: 4, top: 4, flexDirection: "row", gap: 4 }}>
                  {i !== 0 ? (
                    <TouchableOpacity onPress={() => makeCover(i)} style={{ backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 10, padding: 4 }}>
                      <Text style={{ color: "#fff", fontSize: 9, fontWeight: "700" }}>Cover</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity onPress={() => removeImage(i)} style={{ backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 10, padding: 4 }}>
                    <Text style={{ color: "#fff", fontSize: 9, fontWeight: "700" }}>X</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {images.length < 5 ? (
              <TouchableOpacity onPress={uploadImageFile} disabled={uploading} style={{ width: 96, height: 96, borderRadius: 10, borderWidth: 1, borderStyle: "dashed", borderColor: tokens.border.default, backgroundColor: tokens.bg.surfaceMuted, alignItems: "center", justifyContent: "center", opacity: uploading ? 0.7 : 1 }}>
                <Text style={{ color: tokens.text.muted, fontSize: 20 }}>+</Text>
                <Text style={{ color: tokens.text.muted, fontSize: 10, fontWeight: "600" }}>{uploading ? "..." : "Add"}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 16, borderWidth: 1, borderColor: tokens.border.default, padding: 14, marginBottom: 12 }}>
          <Text style={{ fontSize: 13, fontWeight: "800", color: tokens.text.primary, marginBottom: 10 }}>Product video</Text>
          <ImageUpload
            value={videoUrl}
            mediaType={videoUrl ? "video" : "image"}
            onChange={(url) => setVideoUrl(url || "")}
            kind="product"
            acceptVideo
            containerStyle={{ height: 120, width: "100%" }}
          />
        </View>

        <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 16, borderWidth: 1, borderColor: tokens.border.default, padding: 14, marginBottom: 12 }}>
          <Text style={{ fontSize: 13, fontWeight: "800", color: tokens.text.primary, marginBottom: 8 }}>Variants</Text>
        {variants.map((v, i) => (
          <View key={v.key || i} style={{ backgroundColor: tokens.bg.surfaceMuted, padding: 10, borderRadius: 10, marginBottom: 8 }}>
            <TextInput value={v.sku || ""} onChangeText={(t) => { const next = [...variants]; next[i] = { ...next[i], sku: t }; setVariants(next); }} placeholder="SKU" placeholderTextColor={tokens.text.placeholder} style={{ backgroundColor: tokens.bg.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: tokens.text.primary, marginBottom: 6, borderWidth: 1, borderColor: tokens.border.default }} />
            <TextInput value={v.attributesText || ""} onChangeText={(t) => { const next = [...variants]; next[i] = { ...next[i], attributesText: t }; setVariants(next); }} placeholder="Attributes (size: M, color: Black)" placeholderTextColor={tokens.text.placeholder} style={{ backgroundColor: tokens.bg.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: tokens.text.primary, marginBottom: 6, borderWidth: 1, borderColor: tokens.border.default }} />
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
              <TextInput value={String(v.price ?? "")} onChangeText={(t) => { const next = [...variants]; next[i] = { ...next[i], price: t }; setVariants(next); }} placeholder="Price" keyboardType="numeric" placeholderTextColor={tokens.text.placeholder} style={{ flex: 1, backgroundColor: tokens.bg.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: tokens.text.primary, borderWidth: 1, borderColor: tokens.border.default }} />
              <TextInput value={String(v.stock ?? "")} onChangeText={(t) => { const next = [...variants]; next[i] = { ...next[i], stock: t }; setVariants(next); }} placeholder="Stock" keyboardType="numeric" placeholderTextColor={tokens.text.placeholder} style={{ flex: 1, backgroundColor: tokens.bg.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: tokens.text.primary, borderWidth: 1, borderColor: tokens.border.default }} />
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
              <TextInput value={v.packSize || ""} onChangeText={(t) => { const next = [...variants]; next[i] = { ...next[i], packSize: t }; setVariants(next); }} placeholder="Pack size" keyboardType="numeric" placeholderTextColor={tokens.text.placeholder} style={{ flex: 1, backgroundColor: tokens.bg.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: tokens.text.primary, borderWidth: 1, borderColor: tokens.border.default }} />
              <TextInput value={v.packUnit || ""} onChangeText={(t) => { const next = [...variants]; next[i] = { ...next[i], packUnit: t }; setVariants(next); }} placeholder="Pack unit" placeholderTextColor={tokens.text.placeholder} style={{ flex: 1, backgroundColor: tokens.bg.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: tokens.text.primary, borderWidth: 1, borderColor: tokens.border.default }} />
              <TextInput value={v.packLabel || ""} onChangeText={(t) => { const next = [...variants]; next[i] = { ...next[i], packLabel: t }; setVariants(next); }} placeholder="Pack label" placeholderTextColor={tokens.text.placeholder} style={{ flex: 1, backgroundColor: tokens.bg.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: tokens.text.primary, borderWidth: 1, borderColor: tokens.border.default }} />
            </View>
            {v.imageUrl ? <Image source={{ uri: v.imageUrl }} style={{ width: "100%", height: 80, borderRadius: 8, marginBottom: 6 }} /> : null}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
              <TouchableOpacity onPress={async () => {
                const asset = await pickImage();
                if (!asset) return;
                setUploading(true);
                try {
                  const url = await uploadImage(asset, "product");
                  const next = [...variants]; next[i] = { ...next[i], imageUrl: url }; setVariants(next);
                } catch (e) {}
                finally { setUploading(false); }
              }} disabled={uploading} style={{ flex: 1, backgroundColor: tokens.bg.surface, paddingVertical: 8, borderRadius: 8, alignItems: "center", borderWidth: 1, borderColor: tokens.border.default, opacity: uploading ? 0.7 : 1 }}>
                <Text style={{ color: tokens.text.primary, fontSize: 12, fontWeight: "600" }}>{uploading ? "Uploading..." : "Variant image"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={async () => {
                const asset = await pickVideo();
                if (!asset) return;
                setUploading(true);
                try {
                  const url = await uploadImage(asset, "product");
                  const next = [...variants]; next[i] = { ...next[i], videoUrl: url }; setVariants(next);
                } catch (e) {}
                finally { setUploading(false); }
              }} disabled={uploading} style={{ flex: 1, backgroundColor: tokens.bg.surface, paddingVertical: 8, borderRadius: 8, alignItems: "center", borderWidth: 1, borderColor: tokens.border.default, opacity: uploading ? 0.7 : 1 }}>
                <Text style={{ color: tokens.text.primary, fontSize: 12, fontWeight: "600" }}>{uploading ? "Uploading..." : "Variant video"}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: tokens.text.muted, fontSize: 12 }}>Available</Text>
              <Switch value={v.isAvailable !== false} onValueChange={(val) => { const next = [...variants]; next[i] = { ...next[i], isAvailable: val }; setVariants(next); }} trackColor={{ true: tokens.brand.default }} />
            </View>
            <TouchableOpacity onPress={() => setVariants(variants.filter((_, idx) => idx !== i))} style={{ marginTop: 6 }}>
              <Text style={{ color: tokens.status.error, fontSize: 12, fontWeight: "600" }}>Remove</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity onPress={() => setVariants([...variants, { key: `v-${Date.now()}`, sku: "", attributesText: "", price: "", stock: "", isAvailable: true }])} style={{ backgroundColor: tokens.bg.surfaceMuted, paddingVertical: 10, borderRadius: 10, alignItems: "center", marginBottom: 12 }}>
          <Text style={{ color: tokens.text.primary, fontWeight: "600" }}>+ Add variant</Text>
        </TouchableOpacity>
        </View>

        <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 16, borderWidth: 1, borderColor: tokens.border.default, padding: 14, marginBottom: 12 }}>
          <Text style={{ fontSize: 13, fontWeight: "800", color: tokens.text.primary, marginBottom: 8 }}>Option groups</Text>
          <OptionGroupsEditor groups={groups} onChange={setGroups} />
        </View>

        <StickySaveBar dirty={dirty} saving={busy} saveLabel="Save" onSave={submit} onCancel={() => navigation.goBack()} />
      </ScrollView>
    </SafeAreaView>
  );
}