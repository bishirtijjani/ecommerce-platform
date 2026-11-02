import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, Alert, Platform, TextInput } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import FormInput from "../../components/FormInput";
import { useTheme } from "../../theme";
import { useVendorProfile, useStates, useLgas } from "../hooks/useSeller";
import { updateVendorProfile } from "../api/vendorApi";
import { reverseGeocode, reverseGeocodeDetails, searchPlaces } from "../../lib/geocode";
import { useVendorId } from "../hooks/useSeller";
import { pickImage, uploadImage } from "../lib/upload";

import DateTimePicker from "@react-native-community/datetimepicker";
import StickySaveBar from "../components/StickySaveBar";
import ImageUpload from "../components/ImageUpload";
import { useUnsavedChangesGuard } from "../hooks/useUnsavedChangesGuard";

export default function SellerShopProfileScreen() {
  const { tokens } = useTheme();
  const vendorId = useVendorId();
  const navigation = useNavigation();
  const { data: vendor, isLoading, refetch } = useVendorProfile();
  const statesQuery = useStates();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [openingDays, setOpeningDays] = useState([]);
  const [policies, setPolicies] = useState({});
  const [address, setAddress] = useState("");
  const [state, setState] = useState("");
  const [lga, setLga] = useState("");
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [mapAddress, setMapAddress] = useState("");
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isSatellite, setIsSatellite] = useState(true);
  const [mapEditing, setMapEditing] = useState(false);
  const [candidateLat, setCandidateLat] = useState(null);
  const [candidateLng, setCandidateLng] = useState(null);
  const [candidateAddress, setCandidateAddress] = useState("");
  const [candidateState, setCandidateState] = useState("");
  const [candidateLga, setCandidateLga] = useState("");
  const [mapQuery, setMapQuery] = useState("");
  const [mapPredictions, setMapPredictions] = useState([]);
  const mapRef = useRef(null);
  const geocodeTimeout = useRef(null);
  const searchTimeout = useRef(null);
  const [openingTime, setOpeningTime] = useState("08:00");
  const [closingTime, setClosingTime] = useState("22:00");
  const [showOpenPicker, setShowOpenPicker] = useState(false);
  const [showClosePicker, setShowClosePicker] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const lgasQuery = useLgas(state);
  const timeToDate = (value) => {
    const [h, m] = String(value || "00:00").split(":");
    const d = new Date();
    d.setHours(Number(h) || 0, Number(m) || 0, 0, 0);
    return d;
  };
  const formatTime = (date) => `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

  const handleRegionChangeComplete = useCallback((raw) => {
    if (mapEditing) {
      setCandidateLat(raw.latitude);
      setCandidateLng(raw.longitude);
    } else {
      return;
    }
    if (geocodeTimeout.current) clearTimeout(geocodeTimeout.current);
    setIsGeocoding(true);
    setCandidateAddress("");
    geocodeTimeout.current = setTimeout(async () => {
      try {
        const details = await reverseGeocodeDetails(raw.latitude, raw.longitude);
        setCandidateAddress(details.address || "Unknown location");
        setCandidateState(details.state || "");
        setCandidateLga(details.lga || "");
      } catch (e) {
        setCandidateAddress("Unable to determine address");
      } finally {
        setIsGeocoding(false);
      }
    }, 600);
  }, [mapEditing]);

  const handleMapSearch = useCallback((text) => {
    setMapQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (text.trim().length < 2) {
      setMapPredictions([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      try {
        const results = await searchPlaces(text.trim());
        setMapPredictions((results || []).map((r) => ({ id: r.id, label: r.label || r.address || text, address: r.address || "", lat: r.lat, lng: r.lng })));
      } catch (e) {
        setMapPredictions([]);
      }
    }, 300);
  }, []);

  const dirty = useMemo(() => {
    if (saved) return false;
    if (!vendor) return false;
    return (
      name !== (vendor.name || "") ||
      description !== (vendor.description || "") ||
      phone !== (vendor.phone || "") ||
      email !== (vendor.email || "") ||
      JSON.stringify(openingDays) !== JSON.stringify(vendor.openingDays || []) ||
      JSON.stringify(policies) !== JSON.stringify(vendor.policies || {}) ||
      address !== (vendor.address || "") ||
      state !== (vendor.state || "") ||
      lga !== (vendor.lga || "") ||
      openingTime !== (vendor.openingTime || "08:00") ||
      closingTime !== (vendor.closingTime || "22:00") ||
      imageUrl !== (vendor.logoUrl || vendor.imageUrl || "") ||
      coverImageUrl !== (vendor.coverImageUrl || "") ||
      JSON.stringify(photos) !== JSON.stringify(vendor.photos || [])
    );
  }, [name, description, phone, email, openingDays, policies, address, state, lga, openingTime, closingTime, imageUrl, coverImageUrl, photos, vendor, saved]);

  const { showExitConfirm, cancelExit, confirmExit } = useUnsavedChangesGuard(dirty);

  useEffect(() => {
    if (!showExitConfirm) return;
    Alert.alert("Unsaved changes", "Discard your changes?", [
      { text: "Cancel", onPress: cancelExit },
      { text: "Discard", style: "destructive", onPress: confirmExit },
    ]);
  }, [showExitConfirm, cancelExit, confirmExit]);

  useEffect(() => {
    if (vendor) {
       setName(vendor.name || "");
      setDescription(vendor.description || "");
      setPhone(vendor.phone || "");
      setEmail(vendor.email || "");
      setOpeningDays(vendor.openingDays || []);
      setPolicies(vendor.policies || {});
      setAddress(vendor.address || "");
      setMapAddress(vendor.address || "");
      setState(vendor.state || "");
      setLga(vendor.lga || "");
      if (vendor.lat && vendor.lng) {
        setLat(vendor.lat);
        setLng(vendor.lng);
      }
      setOpeningTime(vendor.openingTime || "08:00");
      setClosingTime(vendor.closingTime || "22:00");
      setImageUrl(vendor.logoUrl || vendor.imageUrl || "");
      setCoverImageUrl(vendor.coverImageUrl || "");
      setPhotos(vendor.photos || []);
    }
  }, [vendor]);

  const save = async () => {
    setBusy(true);
    setError("");
    // `logoUrl` is validated as a URL, so an empty string is rejected. Send
    // `undefined` instead so the field is simply omitted and left unchanged.
    try {
      await updateVendorProfile(vendorId, {
        name, description: description || undefined, phone, email: email || undefined, address, state, lga,
        lat: lat ?? undefined,
        lng: lng ?? undefined,
        openingTime, closingTime, openingDays, policies,
        logoUrl: imageUrl || undefined,
        coverImageUrl: coverImageUrl || undefined,
        photos,
       });
      setSaved(true);
      await refetch();
    } catch (e) {
      setError(e?.message || "Could not save your shop location");
    } finally { setBusy(false); }
  };

  
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <ScrollView
        style={{ width: "100%", maxWidth: 760, alignSelf: "center" }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refetch()} tintColor={tokens.brand.default} />}
      >
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 10 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: tokens.bg.surfaceMuted, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="arrow-back" size={18} color={tokens.text.primary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 24, fontWeight: "900", color: tokens.text.primary }}>Shop profile</Text>
        </View>

        <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 16, borderWidth: 1, borderColor: tokens.border.default, padding: 14, marginBottom: 12 }}>
          <Text style={{ fontSize: 13, fontWeight: "800", color: tokens.text.primary, marginBottom: 10 }}>Branding</Text>
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <ImageUpload
                label="Logo"
                value={imageUrl}
                onChange={(url) => setImageUrl(url)}
                kind="vendor_logo"
                containerStyle={{ height: 120, width: "100%" }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <ImageUpload
                label="Cover"
                value={coverImageUrl}
                onChange={(url) => setCoverImageUrl(url)}
                kind="vendor_cover"
                containerStyle={{ height: 120, width: "100%" }}
              />
            </View>
          </View>
          <Text style={{ fontSize: 12, color: tokens.text.muted, marginBottom: 6 }}>Shop photos</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {photos.map((url, idx) => (
              <View key={url + idx} style={{ position: "relative" }}>
                <Image source={{ uri: url }} style={{ width: 72, height: 72, borderRadius: 10 }} />
                <TouchableOpacity onPress={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))} style={{ position: "absolute", top: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>X</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              onPress={async () => {
                const asset = await pickImage();
                if (!asset) return;
                setUploading(true);
                try {
                  const url = await uploadImage(asset, "vendor_cover");
                  setPhotos((prev) => [...prev, url]);
                } catch (e) { Alert.alert("Upload failed", e?.message || "Could not upload photo"); }
                finally { setUploading(false); }
              }}
              disabled={uploading}
              style={{ width: 72, height: 72, borderRadius: 10, backgroundColor: tokens.bg.surfaceMuted, alignItems: "center", justifyContent: "center", opacity: uploading ? 0.7 : 1 }}
            >
              <Text style={{ color: tokens.text.primary, fontSize: 11, fontWeight: "600" }}>{uploading ? "..." : "Add"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 16, borderWidth: 1, borderColor: tokens.border.default, padding: 14, marginBottom: 12 }}>
          <Text style={{ fontSize: 13, fontWeight: "800", color: tokens.text.primary, marginBottom: 10 }}>Business</Text>
          <FormInput label="Shop name" value={name} onChangeText={setName} />
          <FormInput label="Description" value={description} onChangeText={setDescription} multiline />
          <FormInput label="Phone" value={phone} onChangeText={setPhone} />
          <FormInput label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        </View>

        <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 16, borderWidth: 1, borderColor: tokens.border.default, padding: 14, marginBottom: 12 }}>
          <Text style={{ fontSize: 13, fontWeight: "800", color: tokens.text.primary, marginBottom: 10 }}>Location</Text>
          <View style={{ height: 200, borderRadius: 12, overflow: "hidden", marginBottom: 12, borderWidth: 1, borderColor: tokens.border.default, position: "relative" }}>
            <View style={{ flex: 1 }} pointerEvents={mapEditing ? "auto" : "none"}>
            <MapView
              ref={mapRef}
              style={{ flex: 1 }}
              provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
              region={mapEditing ? {
                latitude: candidateLat || lat || 9.082,
                longitude: candidateLng || lng || 8.6753,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              } : {
                latitude: lat || 9.082,
                longitude: lng || 8.6753,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              mapType={isSatellite ? "satellite" : "standard"}
              onRegionChangeComplete={mapEditing ? handleRegionChangeComplete : undefined}
              scrollEnabled={mapEditing}
              zoomEnabled={mapEditing}
              showsUserLocation
            >
              <Marker
                coordinate={{
                  latitude: mapEditing ? (candidateLat || lat || 9.082) : (lat || 9.082),
                  longitude: mapEditing ? (candidateLng || lng || 8.6753) : (lng || 8.6753),
                }}
                pinColor={tokens.brand.default}
              />
            </MapView>
            </View>
            {/* Top-right controls */}
            <View style={{ position: "absolute", top: 8, right: 8, flexDirection: "row", gap: 6 }}>
              <TouchableOpacity
                onPress={() => setIsSatellite((v) => !v)}
                style={{ backgroundColor: tokens.bg.surface, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 }}
              >
                <Text style={{ color: tokens.text.primary, fontWeight: "700", fontSize: 10 }}>{isSatellite ? "Map" : "Sat"}</Text>
              </TouchableOpacity>
              {!mapEditing ? (
                <TouchableOpacity
                  onPress={() => {
                    setCandidateLat(lat);
                    setCandidateLng(lng);
                    setCandidateAddress(address);
                    setCandidateState(state);
                    setCandidateLga(lga);
                    setMapEditing(true);
                  }}
                  style={{ backgroundColor: tokens.brand.default, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
                >
                  <Text style={{ color: tokens.text.onBrand, fontWeight: "700", fontSize: 10 }}>Edit</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    onPress={() => {
                      setLat(candidateLat);
                      setLng(candidateLng);
                      setAddress(candidateAddress || address);
                      setState(candidateState || state);
                      setLga(candidateLga || lga);
                      setMapAddress(candidateAddress || address);
                      setMapEditing(false);
                      setMapQuery("");
                      setMapPredictions([]);
                    }}
                    style={{ backgroundColor: tokens.status.success, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 10 }}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setCandidateLat(lat);
                      setCandidateLng(lng);
                      setCandidateAddress(address);
                      setCandidateState(state);
                      setCandidateLga(lga);
                      setMapEditing(false);
                      setMapQuery("");
                      setMapPredictions([]);
                    }}
                    style={{ backgroundColor: tokens.bg.surface, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
                  >
                    <Text style={{ color: tokens.text.primary, fontWeight: "700", fontSize: 10 }}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
            {/* Search overlay in edit mode */}
            {mapEditing ? (
              <View style={{ position: "absolute", top: 8, left: 8, right: 96 }}>
                <TextInput
                  value={mapQuery}
                  onChangeText={handleMapSearch}
                  placeholder="Search place"
                  placeholderTextColor={tokens.text.placeholder}
                  style={{ backgroundColor: tokens.bg.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, color: tokens.text.primary, fontSize: 12, borderWidth: 1, borderColor: tokens.border.default }}
                />
                {mapPredictions.length > 0 ? (
                  <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 8, marginTop: 4, maxHeight: 120 }}>
                    <ScrollView>
                      {mapPredictions.map((p) => (
                        <TouchableOpacity
                          key={p.id}
                          onPress={() => {
                            setCandidateLat(p.lat);
                            setCandidateLng(p.lng);
                            setCandidateAddress(p.address || p.label);
                            setMapQuery("");
                            setMapPredictions([]);
                            reverseGeocodeDetails(p.lat, p.lng).then((d) => {
                              setCandidateAddress(d.address || p.address || p.label);
                              setCandidateState(d.state || "");
                              setCandidateLga(d.lga || "");
                            }).catch(() => {});
                            if (mapRef.current) mapRef.current.animateToRegion({ latitude: p.lat, longitude: p.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 300);
                          }}
                          style={{ paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: tokens.border.default }}
                        >
                          <Text style={{ color: tokens.text.primary, fontSize: 12, fontWeight: "600" }}>{p.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
          <Text style={{ color: tokens.text.muted, fontSize: 12, marginBottom: 8 }}>
            {mapEditing ? (isGeocoding ? "Finding address..." : (candidateAddress || "Move map to set pin")) : (lat && lng ? (address || "Pin set") : "No pin set")}
          </Text>
          <FormInput label="Address" value={address} onChangeText={setAddress} editable={false} />
          <Text style={{ color: tokens.text.muted, marginBottom: 8 }}>State: {state || "—"} · LGA: {lga || "—"}</Text>
        </View>

        <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 16, borderWidth: 1, borderColor: tokens.border.default, padding: 14, marginBottom: 12 }}>
          <Text style={{ fontSize: 13, fontWeight: "800", color: tokens.text.primary, marginBottom: 10 }}>Hours</Text>
          <Text style={{ color: tokens.text.muted, fontSize: 12, fontWeight: "600", marginBottom: 6 }}>Open days</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((day) => {
              const active = openingDays.includes(day);
              return (
                <TouchableOpacity
                  key={day}
                  onPress={() => setOpeningDays((prev) => active ? prev.filter((d) => d !== day) : [...prev, day])}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: active ? tokens.brand.default : tokens.bg.surfaceMuted, borderWidth: 1, borderColor: active ? tokens.brand.default : tokens.border.default }}
                >
                  <Text style={{ color: active ? tokens.text.onBrand : tokens.text.muted, fontWeight: "700", fontSize: 12 }}>{day}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={{ color: tokens.text.muted, fontSize: 12, fontWeight: "600", marginBottom: 6 }}>Opening time</Text>
          {Platform.OS === "web" ? (
            <FormInput label="" value={openingTime} onChangeText={setOpeningTime} type="time" />
          ) : (
            <>
              <TouchableOpacity onPress={() => setShowOpenPicker(true)} style={{ backgroundColor: tokens.bg.surfaceMuted, borderRadius: 12, borderWidth: 1, borderColor: tokens.border.default, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10 }}>
                <Text style={{ color: tokens.text.primary, fontSize: 16, fontWeight: "500" }}>{openingTime}</Text>
              </TouchableOpacity>
              {showOpenPicker ? (
                <DateTimePicker value={timeToDate(openingTime)} mode="time" is24Hour display="default" onChange={(event, date) => { setShowOpenPicker(false); if (date) setOpeningTime(formatTime(date)); }} />
              ) : null}
            </>
          )}
          <Text style={{ color: tokens.text.muted, fontSize: 12, fontWeight: "600", marginBottom: 6 }}>Closing time</Text>
          {Platform.OS === "web" ? (
            <FormInput label="" value={closingTime} onChangeText={setClosingTime} type="time" />
          ) : (
            <>
              <TouchableOpacity onPress={() => setShowClosePicker(true)} style={{ backgroundColor: tokens.bg.surfaceMuted, borderRadius: 12, borderWidth: 1, borderColor: tokens.border.default, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10 }}>
                <Text style={{ color: tokens.text.primary, fontSize: 16, fontWeight: "500" }}>{closingTime}</Text>
              </TouchableOpacity>
              {showClosePicker ? (
                <DateTimePicker value={timeToDate(closingTime)} mode="time" is24Hour display="default" onChange={(event, date) => { setShowClosePicker(false); if (date) setClosingTime(formatTime(date)); }} />
              ) : null}
            </>
          )}
        </View>

        <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 16, borderWidth: 1, borderColor: tokens.border.default, padding: 14, marginBottom: 12 }}>
          <Text style={{ fontSize: 13, fontWeight: "800", color: tokens.text.primary, marginBottom: 10 }}>Policies</Text>
          <FormInput label="Shipping policy" value={policies.shipping || ""} onChangeText={(t) => setPolicies((p) => ({ ...p, shipping: t }))} multiline />
          <FormInput label="Returns policy" value={policies.returns || ""} onChangeText={(t) => setPolicies((p) => ({ ...p, returns: t }))} multiline />
          <FormInput label="Payment policy" value={policies.payment || ""} onChangeText={(t) => setPolicies((p) => ({ ...p, payment: t }))} multiline />
          <FormInput label="Shop policies" value={policies.shopPolicies || ""} onChangeText={(t) => setPolicies((p) => ({ ...p, shopPolicies: t }))} multiline />
        </View>

        {error ? <Text style={{ color: tokens.status.error, marginBottom: 12 }}>{error}</Text> : null}
        <StickySaveBar dirty={dirty} saving={busy} saveLabel="Save" onSave={save} onCancel={() => navigation.goBack()} />
      </ScrollView>
    </SafeAreaView>
  );
}