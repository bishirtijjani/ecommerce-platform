import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import api from "../../services/api";

export async function pickImage() {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
  if (res.canceled) return null;
  return res.assets?.[0] || null;
}

export async function pickVideo() {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos, quality: 1 });
  if (res.canceled) return null;
  return res.assets?.[0] || null;
}

export async function pickMedia() {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.8 });
  if (res.canceled) return null;
  return res.assets?.[0] || null;
}

const isVideoAsset = (asset) =>
  asset?.type === "video" || String(asset?.mimeType || "").startsWith("video/");

export async function uploadMedia(asset, kind = "product", onProgress) {
  if (!asset) throw new Error("No file selected");
  const isVideo = isVideoAsset(asset);
  const uploadKind = isVideo ? `${kind}_video` : kind;
  const resourceType = isVideo ? "video" : "image";

  const sig = await api.post("/auth/upload-signature", { kind: uploadKind });
  const s = sig?.data || sig;

  const form = new FormData();
  if (Platform.OS === "web") {
    const response = await fetch(asset.uri);
    const blob = await response.blob();
    form.append("file", blob, asset.fileName || (isVideo ? "video.mp4" : "image.jpg"));
  } else {
    form.append("file", {
      uri: asset.uri,
      name: asset.fileName || (isVideo ? "video.mp4" : "image.jpg"),
      type: asset.mimeType || (isVideo ? "video/mp4" : "image/jpeg"),
    });
  }
  form.append("api_key", s.apiKey);
  form.append("timestamp", String(s.timestamp));
  form.append("signature", s.signature);
  form.append("folder", s.folder);
  form.append("public_id", s.publicId);

  const url = `https://api.cloudinary.com/v1_1/${s.cloudName}/${resourceType}/upload`;
  const resp = await fetch(url, { method: "POST", body: form });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json?.error?.message || json?.message || `Upload failed (${resp.status}): ${JSON.stringify(json)}`);
  return { url: json.secure_url, type: isVideo ? "video" : "image" };
}

export async function uploadImage(asset, kind = "product", onProgress) {
  const result = await uploadMedia(asset, kind, onProgress);
  return result.url;
}