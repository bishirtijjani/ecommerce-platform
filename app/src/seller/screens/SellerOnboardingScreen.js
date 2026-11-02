import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Platform, TextInput } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import FormInput from "../../components/FormInput";
import SearchableSelect from "../../components/SearchableSelect";
import { useTheme } from "../../theme";
import { useStates, useLgas, useVendorProfile, useVendorId } from "../hooks/useSeller";
import DateTimePicker from "@react-native-community/datetimepicker";
import { reverseGeocodeDetails, searchPlaces } from "../../lib/geocode";
import { updateVendorProfile, reverseGeocode } from "../api/vendorApi";
import { useDispatch } from "react-redux";
import { fetchProfile } from "../../store/slices/profileSlice";

export default function SellerOnboardingScreen({ navigation }) {
  const { tokens } = useTheme();
  const dispatch = useDispatch();
  const vendorId = useVendorId();
  const { data: vendor } = useVendorProfile();
  const statesQuery = useStates();
  const [state, setState] = useState("");
  const [lga, setLga] = useState("");
  const [address, setAddress] = useState("");
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
  const [openingTime, setOpeningTime] = useState(vendor?.openingTime || "08:00");
  const [closingTime, setClosingTime] = useState(vendor?.closingTime || "22:00");
  const [showOpenPicker, setShowOpenPicker] = useState(false);
  const [showClosePicker, setShowClosePicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lgasQuery = useLgas(state);

  const handleRegionChangeComplete = useCallback((raw) => {
    if (!mapEditing) return;
    setCandidateLat(raw.latitude);
    setCandidateLng(raw.longitude);
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
  const timeToDate = (value) => {
    const [h, m] = String(value || "00:00").split(":");
    const d = new Date();
    d.setHours(Number(h) || 0, Number(m) || 0, 0, 0);
    return d;
  };
  const formatTime = (date) => `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

  useEffect(() => {
    if (vendor) {
      if (vendor.address && vendor.address !== "Pending - set in onboarding") {
        setAddress(vendor.address);
        setMapAddress(vendor.address);
      }
      if (vendor.state) setState(vendor.state);
      if (vendor.lga) setLga(vendor.lga);
      if (vendor.lat && vendor.lng) {
        setLat(vendor.lat);
        setLng(vendor.lng);
      }
    }
  }, [vendor]);

  const submit = async () => {
    setError("");
    if (address.trim().length < 5) return setError("Address too short");
    if (!state) return setError("Select state");
    if (!lga) return setError("Select LGA");
    if (lat == null || lng == null || (lat === 0 && lng === 0)) {
      return setError("Set your shop location on the map");
    }
    setBusy(true);
    try {
      await updateVendorProfile(vendorId, {
        address: address.trim(),
        state,
        lga,
        lat,
        lng,
        openingTime,
        closingTime,
      });
      await dispatch(fetchProfile());
      navigation.replace("SellerTabs");
    } catch (e) {
      setError(e?.message || "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <ScrollView
        style={{ width: "100%", maxWidth: 640, alignSelf: "center" }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
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
        <FormInput label="Shop address" value={address} onChangeText={setAddress} placeholder="Street address" editable={false} />
        <Text style={{ color: tokens.text.muted, marginBottom: 12 }}>State: {state || "—"} · LGA: {lga || "—"}</Text>
        <Text style={{ color: tokens.text.muted, fontSize: 12, fontWeight: "600", marginBottom: 6, marginLeft: 2 }}>Opening time</Text>
        <TouchableOpacity onPress={() => setShowOpenPicker(true)} style={{ backgroundColor: tokens.bg.surface, borderRadius: 12, borderWidth: 1, borderColor: tokens.border.default, paddingHorizontal: 16, paddingVertical: 16, marginBottom: 20 }}>
          <Text style={{ color: tokens.text.primary, fontSize: 16, fontWeight: "500" }}>{openingTime}</Text>
        </TouchableOpacity>
        {showOpenPicker ? (
          <DateTimePicker value={timeToDate(openingTime)} mode="time" is24Hour display="default" onChange={(event, date) => { setShowOpenPicker(false); if (date) setOpeningTime(formatTime(date)); }} />
        ) : null}
        <Text style={{ color: tokens.text.muted, fontSize: 12, fontWeight: "600", marginBottom: 6, marginLeft: 2 }}>Closing time</Text>
        <TouchableOpacity onPress={() => setShowClosePicker(true)} style={{ backgroundColor: tokens.bg.surface, borderRadius: 12, borderWidth: 1, borderColor: tokens.border.default, paddingHorizontal: 16, paddingVertical: 16, marginBottom: 20 }}>
          <Text style={{ color: tokens.text.primary, fontSize: 16, fontWeight: "500" }}>{closingTime}</Text>
        </TouchableOpacity>
        {showClosePicker ? (
          <DateTimePicker value={timeToDate(closingTime)} mode="time" is24Hour display="default" onChange={(event, date) => { setShowClosePicker(false); if (date) setClosingTime(formatTime(date)); }} />
        ) : null}
        {error ? <Text style={{ color: tokens.status.error, marginBottom: 12 }}>{error}</Text> : null}
        <TouchableOpacity onPress={submit} disabled={busy} style={{ backgroundColor: tokens.brand.default, paddingVertical: 14, borderRadius: 12, alignItems: "center", opacity: busy ? 0.7 : 1 }}>
          {busy ? <ActivityIndicator color={tokens.text.onBrand} /> : <Text style={{ color: tokens.text.onBrand, fontWeight: "800" }}>Submit</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}