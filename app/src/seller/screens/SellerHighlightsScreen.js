import React, { useState } from "react";
import { Alert, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme";
import { useVendorHighlights, useVendorId, useVendorProducts } from "../hooks/useSeller";
import { createHighlight, deleteHighlight, createStory, deleteStory, updateStory, reorderStories, updateHighlight } from "../api/vendorApi";
import { pickImage, pickVideo, uploadImage } from "../lib/upload";
import { Card, EmptyState, PageHeader, PrimaryButton } from "../components/ui";

// Stories can be images or Cloudinary videos. A Cloudinary video has no
// thumbnail field, but the first frame can be requested as a JPG.
const storyThumb = (story) => {
  if (!story?.mediaUrl) return null;
  if (story.mediaType !== "video") return story.mediaUrl;
  return story.mediaUrl
    .replace("/video/upload/", "/video/upload/so_0/")
    .replace(/\.(mp4|webm|mov)$/i, ".jpg");
};

const inputStyle = (tokens) => ({
  backgroundColor: tokens.bg.surface,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: tokens.border.default,
  paddingHorizontal: 12,
  paddingVertical: 11,
  color: tokens.text.primary,
  fontSize: 14,
});

export default function SellerHighlightsScreen() {
  const { tokens } = useTheme();
  const vendorId = useVendorId();
  const { data, isLoading, refetch } = useVendorHighlights();
  const highlights = Array.isArray(data) ? data : data?.data || [];
  const { data: productsPage } = useVendorProducts();
  const products = productsPage?.data || productsPage?.products || (Array.isArray(productsPage) ? productsPage : []);

  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [storyFor, setStoryFor] = useState(null);
  const [storyCaption, setStoryCaption] = useState("");
  const [storyImage, setStoryImage] = useState(null);
  const [storyMediaType, setStoryMediaType] = useState("image");
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [uploading, setUploading] = useState(false);

  const create = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await createHighlight(vendorId, { name: newName.trim() });
      setNewName("");
      await refetch();
    } catch (e) {}
    finally { setBusy(false); }
  };

  const remove = (highlight) =>
    Alert.alert("Delete highlight", `Remove "${highlight.name}" and its stories?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try { await deleteHighlight(vendorId, highlight.id); await refetch(); } catch (e) {}
          finally { setBusy(false); }
        },
      },
    ]);

  const addStory = async (highlightId) => {
    if (!storyImage) return;
    setBusy(true);
    try {
      await createStory(vendorId, highlightId, {
        mediaUrl: storyImage,
        mediaType: storyMediaType,
        caption: storyCaption.trim() || undefined,
        productIds: selectedProductIds,
      });
      setStoryFor(null);
      setStoryCaption("");
      setStoryImage(null);
      setStoryMediaType("image");
      setSelectedProductIds([]);
      await refetch();
    } catch (e) {}
    finally { setBusy(false); }
  };

  const removeStory = (highlightId, storyId) =>
    Alert.alert("Delete story", "Remove this story?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try { await deleteStory(vendorId, highlightId, storyId); await refetch(); } catch (e) {}
          finally { setBusy(false); }
        },
      },
    ]);

  const uploadStoryImage = async () => {
    const asset = await pickImage();
    if (!asset) return;
    setUploading(true);
    try {
      const url = await uploadImage(asset, "highlight");
      setStoryImage(url);
      setStoryMediaType("image");
    } catch (e) {}
    finally { setUploading(false); }
  };

  const uploadStoryVideo = async () => {
    const asset = await pickVideo();
    if (!asset) return;
    setUploading(true);
    try {
      const url = await uploadImage(asset, "highlight");
      setStoryImage(url);
      setStoryMediaType("video");
    } catch (e) {}
    finally { setUploading(false); }
  };

  const renderHighlight = (highlight) => {
    const stories = highlight.stories || [];
    const cover = stories[0] ? storyThumb(stories[0]) : null;
    return (
      <Card key={highlight.id} style={{ marginBottom: 12, padding: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              borderWidth: 2,
              borderColor: tokens.brand.default,
              overflow: "hidden",
              backgroundColor: tokens.bg.surfaceMuted,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {cover ? (
              <Image source={{ uri: cover }} style={{ width: 46, height: 46 }} />
            ) : (
              <Ionicons name="images-outline" size={20} color={tokens.text.placeholder} />
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "700", color: tokens.text.primary }}>
              {highlight.name}
            </Text>
            <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 2 }}>
              {stories.length} {stories.length === 1 ? "story" : "stories"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => remove(highlight)}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${highlight.name}`}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              backgroundColor: tokens.status.errorSoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="trash-outline" size={16} color={tokens.status.errorStrong} />
          </TouchableOpacity>
        </View>

        {stories.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingTop: 12 }}
          >
            {stories.map((story) => (
              <View key={story.id} style={{ width: 76 }}>
                <View
                  style={{
                    width: 76,
                    height: 102,
                    borderRadius: 12,
                    overflow: "hidden",
                    backgroundColor: tokens.bg.surfaceMuted,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {storyThumb(story) ? (
                    <Image source={{ uri: storyThumb(story) }} style={{ width: 76, height: 102 }} />
                  ) : (
                    <Ionicons name="image-outline" size={22} color={tokens.text.placeholder} />
                  )}
                  {story.mediaType === "video" ? (
                    <View style={{ position: "absolute", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="play-circle" size={28} color="#FFFFFF" />
                    </View>
                  ) : null}
                   <View style={{ position: "absolute", bottom: 5, left: 5, flexDirection: "row", gap: 4 }}>
                    <TouchableOpacity
                      onPress={() => {
                        const ids = (highlight.stories || []).map((s) => s.id);
                        const idx = ids.indexOf(story.id);
                        if (idx <= 0) return;
                        const next = [...ids];
                        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                        reorderStories(vendorId, highlight.id, next).then(() => refetch()).catch(() => {});
                      }}
                      style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" }}
                    >
                      <Ionicons name="chevron-up" size={12} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        const ids = (highlight.stories || []).map((s) => s.id);
                        const idx = ids.indexOf(story.id);
                        if (idx < 0 || idx >= ids.length - 1) return;
                        const next = [...ids];
                        [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                        reorderStories(vendorId, highlight.id, next).then(() => refetch()).catch(() => {});
                      }}
                      style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" }}
                    >
                      <Ionicons name="chevron-down" size={12} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                   <TouchableOpacity
                    onPress={() => removeStory(highlight.id, story.id)}
                    accessibilityRole="button"
                    accessibilityLabel="Delete story"
                    style={{
                      position: "absolute",
                      top: 5,
                      right: 5,
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: "rgba(0,0,0,0.55)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="close" size={12} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
                <Text numberOfLines={1} style={{ fontSize: 10.5, color: tokens.text.muted, marginTop: 4 }}>
                  {story.caption || "Story"}
                </Text>
              </View>
            ))}
          </ScrollView>
        ) : (
          <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 12 }}>
            No stories yet — add your first one below.
          </Text>
        )}

        {storyFor === highlight.id ? (
          <View
            style={{
              marginTop: 12,
              backgroundColor: tokens.bg.surfaceMuted,
              borderRadius: 12,
              padding: 12,
            }}
          >
            {storyImage ? (
              storyMediaType === "video" ? (
                <View style={{ width: "100%", height: 140, borderRadius: 10, marginBottom: 10, backgroundColor: tokens.bg.surfaceMuted, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: tokens.text.primary, fontWeight: "600" }}>Video selected</Text>
                </View>
              ) : (
                <Image source={{ uri: storyImage }} style={{ width: "100%", height: 140, borderRadius: 10, marginBottom: 10 }} />
              )
            ) : null}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  label={uploading ? "Uploading..." : storyImage && storyMediaType === "image" ? "Change image" : "Pick image"}
                  icon="image-outline"
                  variant="secondary"
                  size="sm"
                  onPress={uploadStoryImage}
                  disabled={uploading}
                />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  label={uploading ? "Uploading..." : storyImage && storyMediaType === "video" ? "Change video" : "Pick video"}
                  icon="videocam-outline"
                  variant="secondary"
                  size="sm"
                  onPress={uploadStoryVideo}
                  disabled={uploading}
                />
              </View>
            </View>
            <TextInput
              value={storyCaption}
              onChangeText={setStoryCaption}
              placeholder="Caption (optional)"
              placeholderTextColor={tokens.text.placeholder}
              style={[inputStyle(tokens), { marginBottom: 10 }]}
            />
            <Text style={{ color: tokens.text.muted, fontSize: 12, fontWeight: "600", marginBottom: 6 }}>Link products (max 2)</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {products.slice(0, 8).map((p) => {
                const active = selectedProductIds.includes(p.id);
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => {
                      if (active) setSelectedProductIds((prev) => prev.filter((id) => id !== p.id));
                      else if (selectedProductIds.length < 2) setSelectedProductIds((prev) => [...prev, p.id]);
                    }}
                    style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: active ? tokens.brand.default : tokens.bg.surfaceMuted, borderWidth: 1, borderColor: active ? tokens.brand.default : tokens.border.default }}
                  >
                    <Text style={{ color: active ? tokens.text.onBrand : tokens.text.muted, fontSize: 11, fontWeight: "700" }}>{p.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <PrimaryButton
                label="Cancel"
                variant="secondary"
                size="sm"
                onPress={() => { setStoryFor(null); setStoryImage(null); setStoryMediaType("image"); setSelectedProductIds([]); setStoryCaption(""); }}
                style={{ flex: 1 }}
              />
              <PrimaryButton
                label="Add story"
                size="sm"
                onPress={() => addStory(highlight.id)}
                disabled={!storyImage}
                loading={busy}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        ) : (
          <PrimaryButton
            label="Add story"
            icon="add-circle-outline"
            variant="soft"
            size="sm"
            onPress={() => setStoryFor(highlight.id)}
            style={{ marginTop: 12 }}
          />
        )}
      </Card>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <ScrollView
        style={{ width: "100%", maxWidth: 960, alignSelf: "center" }}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refetch()} tintColor={tokens.brand.default} />}
      >
        <PageHeader title="Highlights" subtitle="WhatsApp-style stories pinned to your shop." />

        <View style={{ paddingHorizontal: 16 }}>
          <Card padded style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, marginBottom: 8 }}>
              New highlight
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="e.g. New arrivals"
                placeholderTextColor={tokens.text.placeholder}
                style={[inputStyle(tokens), { flex: 1 }]}
              />
              <PrimaryButton
                label="Create"
                size="sm"
                onPress={create}
                disabled={!newName.trim()}
                loading={busy}
                style={{ height: 44 }}
              />
            </View>
          </Card>

          {highlights.length === 0 ? (
            <Card>
              <EmptyState
                icon="sparkles-outline"
                title="No highlights yet"
                subtitle="Group stories into highlights like “New arrivals” or “Behind the scenes”."
              />
            </Card>
          ) : (
            highlights.map(renderHighlight)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
