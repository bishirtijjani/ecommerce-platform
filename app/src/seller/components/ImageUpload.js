import React, { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme";
import { pickImage, pickVideo, uploadImage } from "../lib/upload";

export default function ImageUpload({
  value,
  mediaType = "image",
  onChange,
  kind = "product",
  acceptVideo = false,
  containerStyle,
  label,
}) {
  const { tokens } = useTheme();
  const [uploading, setUploading] = useState(false);

  const handlePick = async () => {
    const asset = acceptVideo ? await pickVideo() : await pickImage();
    // If acceptVideo, allow either; try image first then video if canceled? Simpler: if acceptVideo, use pickMedia-like all. But pickImage/pickVideo separate. We'll do pickImage then if null pickVideo? Instead use a combined approach:
    if (!asset) return;
    setUploading(true);
    try {
      const url = await uploadImage(asset, kind);
      const type = asset.type === "video" || String(asset.mimeType || "").startsWith("video/") ? "video" : "image";
      onChange?.(url, type);
    } catch (e) {
      // surface
    } finally {
      setUploading(false);
    }
  };

  // For acceptVideo, we want to allow picking any media. Override handlePick to try image then video.
  const pick = async () => {
    if (!acceptVideo) return handlePick();
    // try image first
    let asset = await pickImage();
    if (!asset) asset = await pickVideo();
    if (!asset) return;
    setUploading(true);
    try {
      const url = await uploadImage(asset, kind);
      const type = asset.type === "video" || String(asset.mimeType || "").startsWith("video/") ? "video" : "image";
      onChange?.(url, type);
    } catch (e) {
    } finally {
      setUploading(false);
    }
  };

  return (
    <View>
      {label ? <Text style={{ fontSize: 12, color: tokens.text.muted, marginBottom: 6, fontWeight: "600" }}>{label}</Text> : null}
      <TouchableOpacity
        onPress={value ? undefined : pick}
        activeOpacity={0.8}
        style={[
          {
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: tokens.border.default,
            borderRadius: 12,
            backgroundColor: tokens.bg.surfaceMuted,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          },
          containerStyle,
        ]}
      >
        {value ? (
          <View style={{ width: "100%", height: "100%", position: "relative" }}>
            {mediaType === "video" ? (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="videocam-outline" size={28} color={tokens.text.muted} />
                <Text style={{ color: tokens.text.muted, fontSize: 11, marginTop: 4 }}>Video</Text>
              </View>
            ) : (
              <Image source={{ uri: value }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            )}
            <TouchableOpacity
              onPress={() => onChange?.("", "image")}
              style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="close" size={14} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={pick}
              style={{ position: "absolute", bottom: 6, right: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.6)" }}
            >
              <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>Change</Text>
            </TouchableOpacity>
          </View>
        ) : uploading ? (
          <ActivityIndicator color={tokens.brand.default} />
        ) : (
          <View style={{ alignItems: "center", gap: 6 }}>
            <Ionicons name={acceptVideo ? "cloud-upload-outline" : "image-outline"} size={24} color={tokens.text.muted} />
            <Text style={{ color: tokens.text.muted, fontSize: 12, fontWeight: "600" }}>
              {acceptVideo ? "Upload media" : "Upload image"}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}