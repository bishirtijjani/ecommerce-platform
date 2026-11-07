import React, { useEffect, useMemo, useRef, useState } from "react";
import { goBackOr } from "../../lib/goBack";
import { View, Text, TextInput, TouchableOpacity, StatusBar, ScrollView, ActivityIndicator, Platform, Linking } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import * as ExpoLocation from "expo-location";
import { useTheme } from "../../theme";
import { createRequest } from "../../store/slices/requestSlice";
import { ensurePushPermission } from "../../services/pushPermission";
import { detectCurrentLocation } from "../../store/slices/locationSlice";
import { pickMedia, uploadMedia, MAX_REQUEST_IMAGES } from "../../lib/mediaUpload";
import { chooseImageSource } from "../../lib/chooseImageSource";
import { reverseGeocodeState } from "../../lib/geocode";
import { showAlert } from "../../lib/safeAlert";
import { NIGERIA_STATE_NAMES, LGAS_BY_STATE } from "../../data/nigeriaStatesLgas";
import SignInPrompt from "../../components/SignInPrompt";
import SearchableSelect from "../../components/SearchableSelect";

// Search radius options for NEARBY requests (km).
const RADIUS_OPTIONS = [1, 5, 15];

// How a reverse-geocoded / registered region name maps onto our state list.
// Google returns "Lagos", "Lagos State" or "Federal Capital Territory" for the
// same place; our list calls the last one "FCT".
const STATE_ALIASES = { abuja: "FCT", "federal capital territory": "FCT" };

/** Map any free-form region name to a NIGERIA_STATES entry ("" when none). */
const matchStateName = (raw) => {
  const q = String(raw || "").trim().toLowerCase();
  if (!q) return "";
  if (STATE_ALIASES[q]) return STATE_ALIASES[q];
  return (
    NIGERIA_STATE_NAMES.find((n) => n.toLowerCase() === q) ||
    NIGERIA_STATE_NAMES.find((n) => n.toLowerCase().includes(q) || q.includes(n.toLowerCase())) ||
    ""
  );
};

/** Same, for an LGA within a state we already resolved. */
const matchLgaName = (stateName, raw) => {
  const q = String(raw || "").trim().toLowerCase();
  if (!q || !stateName) return "";
  const list = LGAS_BY_STATE[stateName] || [];
  return (
    list.find((n) => n.toLowerCase() === q) ||
    list.find((n) => n.toLowerCase().includes(q) || q.includes(n.toLowerCase())) ||
    ""
  );
};

const Chip = ({ label, active, onPress, tokens }) => (
  <TouchableOpacity
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{ selected: active }}
    style={{
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: active ? tokens.brand.default : tokens.border.default,
      backgroundColor: active ? tokens.brand.soft || tokens.bg.surfaceMuted : tokens.bg.surface,
      marginRight: 8,
      marginBottom: 8,
    }}
  >
    <Text style={{ fontSize: 13, fontWeight: "600", color: active ? tokens.brand.strong : tokens.text.primary }}>
      {label}
    </Text>
  </TouchableOpacity>
);

export default function RequestComposeScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const { tokens, isDark } = useTheme();
  const isAuthenticated = useSelector((s) => s.auth.isAuthenticated);
  const categories = useSelector((s) => s.categories.list) || [];
  const location = useSelector((s) => s.location);
  const profile = useSelector((s) => s.profile.profile);
  const submitting = useSelector((s) => s.request.submitting);

  const [title, setTitle] = useState(route.params?.q || "");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(null);
  const [subcategoryId, setSubcategoryId] = useState(null);
  const [reach, setReach] = useState("NEARBY");
  const [radiusKm, setRadiusKm] = useState(15);
  const [urgency, setUrgency] = useState("NORMAL");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [images, setImages] = useState([]);
  const [video, setVideo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  // Where the need is, as structured location: State (required) + LGA.
  const [stateName, setStateName] = useState("");
  const [lgaName, setLgaName] = useState("");
  const stateTouched = useRef(false);
  const lgaTouched = useRef(false);
  const autoDetectTried = useRef(false);

  // Subcategories of the selected category (from the public /categories list).
  // Choosing one lets the request reach sellers who specifically stock it;
  // changing the category clears any stale subcategory.
  const subcategories = useMemo(() => {
    const cat = categories.find((c) => c.id === categoryId);
    return cat?.subcategories || [];
  }, [categories, categoryId]);
  const selectedSub = subcategories.find((s) => s.id === subcategoryId);

  const chooseCategory = (id) => {
    setCategoryId(id);
    setSubcategoryId(null);
  };

  // LGAs of the chosen state - the LGA select stays disabled until a state is
  // picked, and changing the state clears the now-foreign LGA.
  const lgaOptions = useMemo(() => (stateName ? LGAS_BY_STATE[stateName] || [] : []), [stateName]);

  const hasLocation = location.latitude != null && location.longitude != null;

  // Ask for location permission when the user chooses Nearby. If the OS/browser
  // has already blocked it, explain and offer either settings or Choose area.
  const ensureNearbyLocation = async ({ force = false } = {}) => {
    if (!force && hasLocation) return true;
    try {
      let { status } = await ExpoLocation.getForegroundPermissionsAsync();
      if (status !== "granted") {
        const requested = await ExpoLocation.requestForegroundPermissionsAsync();
        status = requested.status;
      }
      if (status !== "granted") {
        showAlert(
          "Location needed",
          Platform.OS === "web"
            ? "Allow location for this site in your browser settings, then try again."
            : "Allow location access for Marketplace in settings, then try again.",
          [
            { text: "Choose area", onPress: () => setReach("ANYWHERE") },
            ...(Platform.OS !== "web"
              ? [{ text: "Open settings", onPress: () => Linking.openSettings() }]
              : []),
            { text: "Cancel", style: "cancel" },
          ],
        );
        return false;
      }
      const servicesOn = await ExpoLocation.hasServicesEnabledAsync().catch(() => true);
      if (!servicesOn) {
        showAlert("Turn on location", "Enable GPS/location services, then try again.", [{ text: "OK" }]);
        return false;
      }
      dispatch(detectCurrentLocation());
      return true;
    } catch (_) {
      showAlert("Location unavailable", "Please enable location or choose an area.", [
        { text: "Choose area", onPress: () => setReach("ANYWHERE") },
        { text: "Cancel", style: "cancel" },
      ]);
      return false;
    }
  };

  // Prefill State from the account's registration details (async - profile
  // loads after mount), unless the user has already picked one.
  useEffect(() => {
    if (!profile || stateTouched.current || stateName) return;
    const match = matchStateName(profile.state);
    if (match) setStateName(match);
  }, [profile, stateName]);

  useEffect(() => {
    if (!profile || lgaTouched.current || lgaName || !stateName) return;
    const match = matchLgaName(stateName, profile.lga);
    if (match) setLgaName(match);
  }, [profile, stateName, lgaName]);

  // Best-effort State from a freshly resolved GPS fix (never overrides the
  // user's pick, and ignores any region we don't recognise).
  const adoptGpsState = (loc) => {
    const lat = loc?.latitude ?? location.latitude;
    const lng = loc?.longitude ?? location.longitude;
    if (lat == null || lng == null || stateTouched.current) return;
    reverseGeocodeState(lat, lng)
      .then((raw) => {
        const match = matchStateName(raw);
        if (!match) return;
        // Nearby uses the device area; Choose area respects the user's pick.
        setStateName((prev) => (reach === "NEARBY" ? match : prev || match));
      })
      .catch(() => {});
  };

  // Derive the LGA for Nearby from the resolved city/address. The dropdowns
  // are hidden in Nearby; this only feeds the matcher's coarse fallback.
  useEffect(() => {
    if (reach !== "NEARBY" || !stateName) return;
    const match = matchLgaName(stateName, location.city || location.address);
    if (match) setLgaName(match);
  }, [reach, stateName, location.city, location.address]);

  // Grab the current location in the background so NEARBY can rank sellers by
  // real distance. Fully optional: no coords just means matching runs on the
  // State/LGA scope alone. Guarded by a ref so a denied permission doesn't
  // retry in a loop.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (hasLocation) {
      // Reuse a saved location and derive its state/LGA for Nearby.
      adoptGpsState(location);
      return;
    }
    if (!autoDetectTried.current) {
      autoDetectTried.current = true;
      dispatch(detectCurrentLocation())
        .unwrap()
        .then(adoptGpsState)
        .catch(() => {});
    }
  }, [isAuthenticated, hasLocation, location.latitude, location.longitude, reach, dispatch]);

  const addImage = (source) => async () => {
    if (images.length >= MAX_REQUEST_IMAGES || uploading) return;
    const picked = await pickMedia({ source, video: false });
    if (!picked) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadMedia(picked.uri, "request", "image");
      setImages((prev) => [...prev, url]);
    } catch (err) {
      setError(err?.message || "Could not upload that photo. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const addVideo = async () => {
    if (video || uploading) return;
    const picked = await pickMedia({ video: true });
    if (!picked) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadMedia(picked.uri, "request", "video");
      setVideo(url);
    } catch (err) {
      setError(err?.message || "Could not upload that video. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (url) => setImages((prev) => prev.filter((u) => u !== url));

  if (!isAuthenticated) {
    return <SignInPrompt icon="megaphone-outline" title="Sign in to post a request" />;
  }

  const submit = async () => {
    if (title.trim().length < 3) {
      setError("Please describe what you need (at least 3 characters).");
      return;
    }
    const isNearby = reach === "NEARBY";
    if (isNearby && !hasLocation) {
      setError("Turn on location or choose an area.");
      return;
    }
    if (!isNearby && !stateName) {
      setError("Please pick the state where you need this.");
      return;
    }
    setError(null);
    // Posting fans this out to sellers who will notify the customer back -
    // the ideal moment to offer push (with a reason), without blocking submit.
    ensurePushPermission("request");
    try {
      const created = await dispatch(
        createRequest({
          title: title.trim(),
          description: description.trim() || null,
          images,
          videos: video ? [video] : [],
          categoryId: categoryId || null,
          subcategoryId: subcategoryId || null,
          reach,
          radiusKm: isNearby ? radiusKm : undefined,
          urgency,
          budgetMin: budgetMin ? Number(budgetMin) : null,
          budgetMax: budgetMax ? Number(budgetMax) : null,
          address: isNearby
            ? (location.address || [lgaName, stateName].filter(Boolean).join(", ") || "Near me")
            : ([lgaName, stateName].filter(Boolean).join(", ") || "Location"),
          // Coordinates only for Nearby. Choose-area is scoped by State/LGA.
          lat: isNearby && hasLocation ? location.latitude : null,
          lng: isNearby && hasLocation ? location.longitude : null,
          state: stateName || null,
          lga: lgaName || null,
        }),
      ).unwrap();
      navigation.replace("RequestDetail", { requestId: created.id });
    } catch (err) {
      setError(typeof err === "string" ? err : err?.message || "Could not post your request.");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={tokens.bg.canvas} />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingVertical: 16,
        }}
      >
        <TouchableOpacity
          onPress={() => goBackOr(navigation)}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: tokens.bg.surfaceMuted,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 14,
          }}
        >
          <Ionicons name="arrow-back" size={20} color={tokens.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: "900", color: tokens.text.primary }}>Post a request</Text>
          <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 2 }}>
            Tell us what you need, nearby sellers will respond.
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.text.primary, marginBottom: 8 }}>
          What do you need?
        </Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Drone motors, a mechanic, a tailor for Eid"
          placeholderTextColor={tokens.text.placeholder}
          style={{
            backgroundColor: tokens.bg.surface,
            borderWidth: 1,
            borderColor: tokens.border.default,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 14,
            color: tokens.text.primary,
            outlineStyle: "none",
          }}
        />
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Add details (optional), size, brand, quantity, when you need it"
          placeholderTextColor={tokens.text.placeholder}
          multiline
          numberOfLines={4}
          style={{
            backgroundColor: tokens.bg.surface,
            borderWidth: 1,
            borderColor: tokens.border.default,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 14,
            color: tokens.text.primary,
            marginTop: 10,
            minHeight: 90,
            textAlignVertical: "top",
            outlineStyle: "none",
          }}
        />

        <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.text.primary, marginTop: 22, marginBottom: 8 }}>
          Photos &amp; video (optional)
        </Text>
        <Text style={{ fontSize: 11, color: tokens.text.muted, marginBottom: 8 }}>
          Add up to {MAX_REQUEST_IMAGES} photos and one short video (max 60s) to help sellers understand what you need.
        </Text>

        {images.length > 0 || video ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            {images.map((url) => (
              <View key={url} style={{ position: "relative" }}>
                <Image source={{ uri: url }} style={{ width: 72, height: 72, borderRadius: 10, backgroundColor: tokens.bg.surfaceMuted }} />
                <TouchableOpacity
                  onPress={() => removeImage(url)}
                  accessibilityRole="button"
                  accessibilityLabel="Remove photo"
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 2,
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: tokens.overlay.scrim,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="close" size={14} color={tokens.text.onElevated} />
                </TouchableOpacity>
              </View>
            ))}
            {video ? (
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 10,
                  backgroundColor: tokens.bg.surfaceMuted,
                  borderWidth: 1,
                  borderColor: tokens.border.default,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="videocam" size={26} color={tokens.brand.strong} />
                <Text style={{ fontSize: 9, color: tokens.text.muted, marginTop: 2 }}>Video</Text>
                <TouchableOpacity
                  onPress={() => setVideo(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Remove video"
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 2,
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: tokens.overlay.scrim,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="close" size={14} color={tokens.text.onElevated} />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={{ flexDirection: "row", gap: 8 }}>
          {images.length < MAX_REQUEST_IMAGES ? (
            <TouchableOpacity
              onPress={() =>
                chooseImageSource(addImage("camera"), addImage("library"), {
                  title: "Attach a photo",
                  camera: "Camera",
                  gallery: "Photo Library",
                  cancel: "Cancel",
                })
              }
              disabled={uploading}
              accessibilityRole="button"
              accessibilityLabel="Add photo"
              accessibilityState={{ disabled: uploading, busy: uploading }}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 11,
                borderRadius: 12,
                backgroundColor: tokens.bg.surfaceMuted,
                opacity: uploading ? 0.6 : 1,
              }}
            >
              <Ionicons name="image-outline" size={16} color={tokens.brand.strong} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.brand.strong }}>Add photo</Text>
            </TouchableOpacity>
          ) : null}

          {!video ? (
            <TouchableOpacity
              onPress={addVideo}
              disabled={uploading}
              accessibilityRole="button"
              accessibilityLabel="Add video"
              accessibilityState={{ disabled: uploading, busy: uploading }}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 11,
                borderRadius: 12,
                backgroundColor: tokens.bg.surfaceMuted,
                opacity: uploading ? 0.6 : 1,
              }}
            >
              <Ionicons name="videocam-outline" size={16} color={tokens.brand.strong} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.brand.strong }}>Add video</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {uploading ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
            <ActivityIndicator size="small" color={tokens.brand.strong} />
            <Text style={{ fontSize: 11, color: tokens.text.muted }}>Uploading…</Text>
          </View>
        ) : null}

        <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.text.primary, marginTop: 22, marginBottom: 8 }}>
          Category (optional)
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          <Chip label="Other / not sure" active={categoryId === null} onPress={() => chooseCategory(null)} tokens={tokens} />
          {categories.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              active={categoryId === c.id}
              onPress={() => chooseCategory(c.id)}
              tokens={tokens}
            />
          ))}
        </View>

        {subcategories.length > 0 ? (
          <View style={{ marginTop: 14 }}>
            <SearchableSelect
              label="Subcategory (optional)"
              value={selectedSub?.name || ""}
              placeholder="Any subcategory"
              options={["Any subcategory", ...subcategories.map((s) => s.name)]}
              onSelect={(name) => {
                if (name === "Any subcategory") {
                  setSubcategoryId(null);
                  return;
                }
                const match = subcategories.find((s) => s.name === name);
                setSubcategoryId(match ? match.id : null);
              }}
            />
            <Text style={{ fontSize: 11, color: tokens.text.muted, marginTop: -6 }}>
              Pick one to reach sellers who specifically have what you need.
            </Text>
          </View>
        ) : null}

        <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.text.primary, marginTop: 22, marginBottom: 8 }}>
          Where should we search?
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          <Chip
            label="Near me"
            active={reach === "NEARBY"}
            onPress={() => {
              stateTouched.current = false;
              lgaTouched.current = false;
              setReach("NEARBY");
              ensureNearbyLocation();
            }}
            tokens={tokens}
          />
          <Chip label="Choose area" active={reach === "ANYWHERE"} onPress={() => setReach("ANYWHERE")} tokens={tokens} />
        </View>
        {reach === "NEARBY" && (
          <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 4 }}>
              {RADIUS_OPTIONS.map((r) => (
                <Chip key={r} label={`${r} km`} active={radiusKm === r} onPress={() => setRadiusKm(r)} tokens={tokens} />
              ))}
            </View>
            {hasLocation ? (
              <View style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 12, color: tokens.text.muted }}>
                  Searching around {lgaName ? `${lgaName}, ` : ""}{stateName || "your location"}
                </Text>
                <TouchableOpacity onPress={() => ensureNearbyLocation({ force: true })} style={{ marginTop: 4 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.brand.default }}>Use my exact location</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 12, color: tokens.text.muted }}>
                  We couldn't get your location.
                </Text>
                <View style={{ flexDirection: "row", gap: 14, marginTop: 6 }}>
                  <TouchableOpacity onPress={() => ensureNearbyLocation()}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.brand.default }}>Use my location</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setReach("ANYWHERE")}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.brand.default }}>Choose area instead</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        )}

        {reach === "ANYWHERE" && (
          <>
            <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.text.primary, marginTop: 14, marginBottom: 8 }}>
              Where is it?
            </Text>
            <SearchableSelect
              label="State"
              value={stateName}
              placeholder="Select a state"
              options={NIGERIA_STATE_NAMES}
              onSelect={(v) => {
                stateTouched.current = true;
                setStateName(v);
                // The picked LGA belonged to the previous state.
                setLgaName("");
              }}
            />
            <SearchableSelect
              label="LGA"
              value={lgaName}
              placeholder={stateName ? "Any LGA in this state" : "Pick a state first"}
              options={lgaOptions}
              disabled={!stateName}
              onSelect={(v) => {
                lgaTouched.current = true;
                setLgaName(v);
              }}
            />
          </>
        )}

        <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.text.primary, marginTop: 22, marginBottom: 8 }}>
          How urgent?
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          <Chip label="Normal" active={urgency === "NORMAL"} onPress={() => setUrgency("NORMAL")} tokens={tokens} />
          <Chip label="Urgent" active={urgency === "URGENT"} onPress={() => setUrgency("URGENT")} tokens={tokens} />
        </View>

        <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.text.primary, marginTop: 22, marginBottom: 8 }}>
          Budget (optional)
        </Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TextInput
            value={budgetMin}
            onChangeText={setBudgetMin}
            keyboardType="numeric"
            placeholder="Min ₦"
            placeholderTextColor={tokens.text.placeholder}
            style={{
              flex: 1,
              backgroundColor: tokens.bg.surface,
              borderWidth: 1,
              borderColor: tokens.border.default,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 14,
              color: tokens.text.primary,
              outlineStyle: "none",
            }}
          />
          <TextInput
            value={budgetMax}
            onChangeText={setBudgetMax}
            keyboardType="numeric"
            placeholder="Max ₦"
            placeholderTextColor={tokens.text.placeholder}
            style={{
              flex: 1,
              backgroundColor: tokens.bg.surface,
              borderWidth: 1,
              borderColor: tokens.border.default,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 14,
              color: tokens.text.primary,
              outlineStyle: "none",
            }}
          />
        </View>

        {error ? (
          <Text style={{ color: tokens.status.error, fontSize: 13, marginTop: 16 }}>{error}</Text>
        ) : null}

        <TouchableOpacity
          onPress={submit}
          disabled={submitting || uploading}
          accessibilityRole="button"
          style={{
            marginTop: 24,
            backgroundColor: tokens.brand.default,
            borderRadius: 14,
            paddingVertical: 15,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8,
            opacity: submitting || uploading ? 0.7 : 1,
          }}
        >
          {submitting ? (
            <ActivityIndicator color={tokens.text.onBrand} />
          ) : (
            <>
              <Ionicons name="megaphone-outline" size={18} color={tokens.text.onBrand} />
              <Text style={{ color: tokens.text.onBrand, fontWeight: "800", fontSize: 15 }}>
                Send to sellers
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
