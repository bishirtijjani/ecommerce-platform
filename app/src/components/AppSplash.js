/**
 * AppSplash - the branded boot splash.
 *
 * A full-screen brand-green overlay (same colour + mark as the native splash
 * configured in app.json) with the "Marketplace" lettermark in white BELOW the
 * logo. It stays up for at least MIN_MS after the bundle starts executing -
 * on web that is page load, on native it is app launch - then fades out. A
 * slow boot simply extends it, so users never see a half-ready app flash by.
 *
 * Web: before JS boots, the first paint is the static #web-splash div that
 * scripts/inject-pwa.js injects into index.html. On mount this overlay covers
 * it (identical colours) and removes it, so there is no white flash and no
 * visible seam between the static and the live splash.
 */
import React, { useEffect, useRef, useState } from "react";
import { Animated, Platform, StyleSheet, Text } from "react-native";
import { Image } from "expo-image";

export const SPLASH_BG = "#0B3D24";

// Minimum time the splash stays on screen (ms). Client asked for 1.5-2s.
const MIN_MS = 1800;
const FADE_MS = 260;

// Captured at module evaluation, i.e. the same instant the bundle starts
// running - the true "app start" on both platforms.
const startedAt = Date.now();

export default function AppSplash() {
  const [visible, setVisible] = useState(true);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Web only: drop the static first-paint splash. This overlay is already
    // painted on top of it with the same background, so the swap is invisible.
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const el = document.getElementById("web-splash");
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }

    const hold = Math.max(0, MIN_MS - (Date.now() - startedAt));
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_MS,
        // RN-web has no native driver; false works identically on native.
        useNativeDriver: false,
      }).start(() => setVisible(false));
    }, hold);
    return () => clearTimeout(timer);
  }, [opacity]);

  if (!visible) return null;

  return (
    <Animated.View
      // Never blocks taps, even mid-fade.
      pointerEvents="none"
      accessible
      accessibilityRole="image"
      accessibilityLabel="Marketplace"
      style={[StyleSheet.absoluteFillObject, styles.root, { opacity }]}
    >
      <Image source={require("../../assets/splash-icon.png")} style={styles.logo} contentFit="contain" />
      <Text style={styles.wordmark}>Marketplace</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: SPLASH_BG,
    alignItems: "center",
    justifyContent: "center",
    // Sits above every screen, toast and sheet (they use 10-ish).
    zIndex: 9999,
    elevation: 9999,
  },
  logo: { width: 108, height: 108, marginBottom: 18 },
  wordmark: {
    color: "#FFFFFF",
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
});
