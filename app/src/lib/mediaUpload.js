/**
 * Picking + uploading request media (images or a short video) through the
 * existing Cloudinary signed-upload flow.
 *
 * `kind` selects the folder/prefix on the backend (see
 * auth.service.getCloudinaryUploadSignature); a video uses `<kind>_video` and
 * the `/video/upload` Cloudinary endpoint.
 */

import { Platform, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import api from "../services/api";
import { appendUploadFile } from "./uploadFile";

const VIDEO_MAX_DURATION = 60;

const extOf = (uri) => {
  const name = (uri || "").split("/").pop() || "";
  const match = /\.([a-z0-9]+)(?:\?|$)/i.exec(name);
  return match ? match[1].toLowerCase() : "";
};

/**
 * Launch the picker. Returns `{ uri, type }` where type is "image" | "video",
 * or null when the user cancels / permission is denied.
 *
 * `source` is only meaningful for images on native ("camera" | "library");
 * video is always chosen from the library (recording is out of scope).
 */
export const pickMedia = async ({ source = "library", video = false } = {}) => {
  const mediaTypes = video ? ["videos"] : ["images"];

  if (Platform.OS === "web") {
    // Browser file dialog handles permission + source. Don't await a permission
    // first - that drops the user gesture and the dialog wouldn't open.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes,
      allowsEditing: false,
      quality: 0.8,
      videoMaxDuration: VIDEO_MAX_DURATION,
    });
    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset) return null;
    return { uri: asset.uri, type: asset.type === "video" ? "video" : "image" };
  }

  if (!video && source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Camera access is required to take a photo.");
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.8,
    });
    const asset = result.canceled ? null : result.assets?.[0];
    return asset ? { uri: asset.uri, type: "image" } : null;
  }

  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(
      "Permission needed",
      video ? "Library access is required to choose a video." : "Library access is required to choose a photo.",
    );
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes,
    allowsEditing: false,
    quality: 0.8,
    videoMaxDuration: VIDEO_MAX_DURATION,
  });
  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset) return null;
  return { uri: asset.uri, type: video || asset.type === "video" ? "video" : "image" };
};

/**
 * Upload one picked asset to Cloudinary and return its secure URL.
 * `type` is "image" | "video"; video gets a `<kind>_video` signature and the
 * video upload endpoint.
 */
export const uploadMedia = async (uri, kind, type = "image") => {
  const isVideo = type === "video";

  const sigEnvelope = await api.post("/auth/upload-signature", {
    kind: isVideo ? `${kind}_video` : kind,
  });
  const sig = sigEnvelope?.data;
  if (!sig) throw new Error("Failed to get upload signature");

  const filename = uri.split("/").pop() || (isVideo ? "video.mp4" : "image.jpg");
  const fallbackExt = isVideo ? "mp4" : "jpg";
  const ext = extOf(uri) || fallbackExt;
  const mime = isVideo
    ? `video/${ext === "mov" ? "quicktime" : ext}`
    : `image/${ext === "jpg" ? "jpeg" : ext}`;

  const formData = new FormData();
  await appendUploadFile(formData, uri, { name: filename, type: mime });
  formData.append("api_key", sig.apiKey);
  formData.append("timestamp", sig.timestamp);
  formData.append("signature", sig.signature);
  formData.append("folder", sig.folder);
  formData.append("public_id", sig.publicId);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${sig.cloudName}/${isVideo ? "video" : "image"}/upload`,
    {
      method: "POST",
      body: formData,
      // On web, fetch must set the multipart boundary itself, so don't pin
      // Content-Type there; native RN keeps the explicit header it expects.
      headers:
        Platform.OS === "web"
          ? { Accept: "application/json" }
          : { Accept: "application/json", "Content-Type": "multipart/form-data" },
    },
  );

  if (!response.ok) {
    const txt = await response.text().catch(() => "");
    throw new Error(`Cloudinary upload failed: ${txt || response.status}`);
  }
  const data = await response.json();
  return data.secure_url;
};

export const MAX_REQUEST_IMAGES = 5;
