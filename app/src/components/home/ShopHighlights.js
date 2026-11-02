import React, { useState, useEffect, useRef } from "react";
import { View, Text, Modal, TouchableOpacity, TouchableWithoutFeedback, ScrollView, StyleSheet, Dimensions, Platform, Animated } from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../theme";

const SCREEN = Dimensions.get("window");
const IMAGE_DURATION_MS = 4000;

// Horizontal bar of a shop's story highlights (Instagram-style). A highlight
// with no cover AND no stories is not rendered - there is never a placeholder
// tile, only real content. Tapping one opens StoryViewer.
export function ShopHighlightsBar({ highlights, onHighlightPress }) {
  const { tokens } = useTheme();
  if (!highlights || highlights.length === 0) return null;

  return (
    <View style={{ marginTop: 16, paddingHorizontal: 16 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 14 }}
      >
        {highlights.map((h) => {
          // Never render a tile with no visual content.
          if (!h.coverImageUrl || !h.stories || h.stories?.length === 0) return null;
          return (
            <TouchableOpacity
              key={h.id}
              activeOpacity={0.7}
              onPress={() => onHighlightPress(h)}
              style={{ alignItems: "center", width: 76 }}
            >
              <View
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: 34,
                  padding: 3,
                  ...Platform.select({
                    ios: { shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
                    android: { elevation: 2 },
                    web: { boxShadow: "0 2px 6px rgba(0,0,0,0.10)" },
                  }),
                }}
              >
                <LinearGradient
                  colors={[tokens.brand.default, tokens.status.success]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ width: "100%", height: "100%", borderRadius: 999, padding: 2 }}
                >
                  <View
                    style={{
                      flex: 1,
                      borderRadius: 999,
                      overflow: "hidden",
                      borderWidth: 2,
                      borderColor: tokens.bg.canvas,
                      backgroundColor: tokens.bg.surfaceMuted,
                    }}
                  >
                    <Image source={{ uri: h.coverImageUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  </View>
                </LinearGradient>
              </View>
              <Text
                style={{ fontSize: 10, fontWeight: "600", color: tokens.text.muted, marginTop: 4, textAlign: "center" }}
                numberOfLines={1}
              >
                {h.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// Fullscreen story viewer (WhatsApp/Instagram-style status). Stories
// auto-advance on a timer; tapping left/right or the chevrons still works and
// simply resets the timer. A story can carry up to two linked products (the
// vendor's own catalogue); those render as tappable cards that deep-link into
// ProductDetail via onOpenProduct.
export function StoryViewer({ visible, highlight, startIndex = 0, onClose, onOpenProduct }) {
  const { tokens } = useTheme();
  const [index, setIndex] = useState(startIndex);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setIndex(startIndex);
  }, [startIndex]);

  const stories = visible && highlight && highlight.stories && highlight.stories?.length > 0 ? highlight.stories : [];
  const story = stories[index] || stories[0];
  const isVideo = story && story.mediaType === "video";

  // Refs so the auto-advance timer and the video end handler always read the
  // latest values. The parent recreates onClose on every render; if we put it
  // (or index/count) directly in the timer effect deps the timer would restart
  // on each parent render, so the progress bar never fills and stories never
  // auto-advance. These refs decouple the timers from parent re-renders.
  const onCloseRef = useRef(onClose);
  const indexRef = useRef(index);
  const countRef = useRef(stories?.length);
  useEffect(() => {
    onCloseRef.current = onClose;
    indexRef.current = index;
    countRef.current = stories?.length;
  }, [onClose, index, stories?.length]);

  // Create a video player bound to the current story's source. When the story
  // index changes (or becomes null), we recreate it with the new source.
  // NOTE: we do NOT call play() in the setup callback — that runs during render,
  // before the <VideoView> has mounted, so on web expo-video play() is a no-op
  // (it only plays mounted videos). Playback is instead started in a useEffect
  // after the VideoView is rendered. Videos start muted so they autoplay
  // reliably on web; the user can unmute via the toggle in the header.
  const [muted, setMuted] = useState(true);
  const videoSource = isVideo ? story.mediaUrl : null;
  const player = useVideoPlayer(videoSource, (p) => {
    if (videoSource) {
      p.loop = false;
      p.timeUpdateEventInterval = 0.1;
      p.muted = true;
    }
  });

  // Keep the player's mute state in sync with the user's toggle.
  useEffect(() => {
    if (player && videoSource) player.muted = muted;
  }, [player, videoSource, muted]);

  // Start (or restart) playback once the player exists and the story is a video.
  // This runs after render so the VideoView is mounted on web.
  useEffect(() => {
    if (isVideo && visible && videoSource && player) {
      player.play();
    }
  }, [isVideo, visible, videoSource, player]);

  // Unified auto-advance + progress bar. Runs while the viewer is open, for
  // both image and video stories. Drives the active progress-bar segment AND
  // advances to the next story (closing on the last) using real elapsed time
  // or the video's actual playback position. It deliberately does NOT depend
  // on expo-video's timeUpdate/playToEnd events or on the parent's onClose
  // identity — both are unreliable on web and on parent re-renders, which was
  // why stories never advanced and the bar never filled.
  useEffect(() => {
    if (!visible || stories?.length === 0) return;

    const advance = () => {
      const i = indexRef.current;
      const total = countRef.current;
      if (i < total - 1) {
        setIndex(i + 1);
      } else if (onCloseRef.current) {
        onCloseRef.current();
      }
    };

    if (isVideo) {
      // Video story: read the player's real position to fill the bar and
      // advance when playback reaches the end.
      const iv = setInterval(() => {
        const d = player.duration || 0;
        const t = player.currentTime || 0;
        if (d > 0) progress.setValue(Math.min(1, t / d));
        if (d > 0 && t >= d - 0.1) {
          clearInterval(iv);
          advance();
        }
      }, 100);
      return () => clearInterval(iv);
    }

    // Image story: ease the bar linearly over the fixed duration, then advance.
    progress.setValue(0);
    const start = Date.now();
    const iv = setInterval(() => {
      const frac = Math.min(1, (Date.now() - start) / IMAGE_DURATION_MS);
      progress.setValue(frac);
      if (frac >= 1) {
        clearInterval(iv);
        advance();
      }
    }, 30);
    return () => clearInterval(iv);
  }, [visible, index, stories?.length, isVideo, player, progress]);

  if (!visible || !highlight) return null;
  if (stories?.length === 0) return null;

  const linkedProducts = story.products || [];

  const goPrev = () => {
    if (index > 0) setIndex(index - 1);
    else if (onCloseRef.current) onCloseRef.current();
  };
  const goNext = () => {
    if (index < stories?.length - 1) setIndex(index + 1);
    else if (onCloseRef.current) onCloseRef.current();
  };
  const close = () => onCloseRef.current && onCloseRef.current();

  // Left third = previous, right third = next. Auto-advance handles the
  // timing; a manual tap just jumps the index and restarts the timer.
  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
      <TouchableWithoutFeedback onPress={close}>
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#000" }]}>
          {/* Progress bar - one segment per story; the active segment fills
              over the story duration (WhatsApp/Instagram style) */}
          <View style={{ position: "absolute", top: Platform.select({ ios: 34, web: 0, default: 0 }), left: 0, right: 0, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6, zIndex: 10 }}>
            <View style={{ flexDirection: "row", height: 3 }}>
              {stories.map((s, i) => {
                const isActive = i === index;
                const isDone = i < index;
                const fillStyle = isActive
                  ? { width: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }
                  : { width: isDone ? "100%" : "0%" };
                return (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      height: "100%",
                      marginRight: i < stories?.length - 1 ? 4 : 0,
                      borderRadius: 2,
                      backgroundColor: "rgba(255,255,255,0.25)",
                      overflow: "hidden",
                    }}
                  >
                    <Animated.View style={[fillStyle, { height: "100%", backgroundColor: "#fff", borderRadius: 2 }]} />
                  </View>
                );
              })}
            </View>
          </View>

          {/* Header */}
          <View
            style={{
              position: "absolute",
              top: Platform.select({ ios: 34, web: 0, default: 0 }),
              left: 0,
              right: 0,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 10,
              zIndex: 10,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {highlight.coverImageUrl || stories[0]?.mediaUrl ? (
                <Image
                  source={{ uri: highlight.coverImageUrl || stories[0].mediaUrl }}
                  style={{ width: 26, height: 26, borderRadius: 6 }}
                  contentFit="cover"
                />
              ) : null}
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFF" }} numberOfLines={1}>
                {highlight.name}
              </Text>
              {isVideo && (
                <Ionicons name="videocam" size={14} color="rgba(255,255,255,0.6)" />
              )}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>
                {index + 1} / {stories?.length}
              </Text>
              {isVideo && (
                <TouchableOpacity
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => setMuted((m) => !m)}
                  accessibilityLabel={muted ? "Unmute video" : "Mute video"}
                >
                  <Ionicons
                    name={muted ? "volume-mute" : "volume-high"}
                    size={20}
                    color="#FFF"
                  />
                </TouchableOpacity>
              )}
              <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={close}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Story media — video or image */}
          {isVideo ? (
            <VideoView
              player={player}
              style={{
                width: SCREEN.width,
                height: SCREEN.height,
                backgroundColor: "#111",
              }}
              contentFit="contain"
              nativeControls={false}
            />
          ) : (
            <Image
              source={{ uri: story.mediaUrl }}
              style={{
                width: SCREEN.width,
                height: SCREEN.height,
                backgroundColor: "#111",
              }}
              contentFit="contain"
            />
          )}

          {/* Linked products - up to two tappable cards, deep-link to ProductDetail */}
          {linkedProducts.length > 0 && (
            <View
              style={{
                position: "absolute",
                left: 12,
                right: 12,
                bottom: Math.max(0, SCREEN.height * 0.06),
                gap: 8,
                zIndex: 5,
              }}
            >
              {linkedProducts.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  activeOpacity={0.85}
                  onPress={() => onOpenProduct && onOpenProduct(p.id)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "rgba(20,20,20,0.92)",
                    borderRadius: 14,
                    padding: 10,
                    gap: 12,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.18)",
                  }}
                >
                  {p.imageUrl ? (
                    <Image source={{ uri: p.imageUrl }} style={{ width: 46, height: 46, borderRadius: 9 }} contentFit="cover" />
                  ) : (
                    <View style={{ width: 46, height: 46, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="image-outline" size={20} color="rgba(255,255,255,0.6)" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13.5, fontWeight: "700", color: "#FFF" }} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: tokens.brand.light || "#FDBA74", marginTop: 2 }}>
                      ₦{Number(p.price).toLocaleString()}
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: "#FFF",
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                    }}
                  >
                    <Text style={{ fontSize: 11.5, fontWeight: "800", color: "#111" }}>View</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Caption */}
          {story.caption ? (
            <View
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: Math.max(0, SCREEN.height * 0.06) + (linkedProducts.length > 0 ? linkedProducts.length * 66 + 8 : 0),
                paddingHorizontal: 16,
                paddingVertical: 14,
                paddingBottom: 24,
              }}
            >
              <Text style={{ fontSize: 14, lineHeight: 20, color: "#FFF" }}>{story.caption}</Text>
            </View>
          ) : null}

          {/* Prev / Next chevrons */}
          {index > 0 && (
            <TouchableOpacity
              onPress={goPrev}
              style={{
                position: "absolute",
                left: 8,
                top: SCREEN.height / 2 - 24,
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: "rgba(0,0,0,0.45)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="chevron-back" size={26} color="#FFF" />
            </TouchableOpacity>
          )}
          {index < stories?.length - 1 && (
            <TouchableOpacity
              onPress={goNext}
              style={{
                position: "absolute",
                right: 8,
                top: SCREEN.height / 2 - 24,
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: "rgba(0,0,0,0.45)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="chevron-forward" size={26} color="#FFF" />
            </TouchableOpacity>
          )}

          {/* Tap zones: left third = prev, right third = next */}
          <TouchableWithoutFeedback onPress={goPrev}>
            <View
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: SCREEN.width / 3,
                height: SCREEN.height,
              }}
            />
          </TouchableWithoutFeedback>
          <TouchableWithoutFeedback onPress={goNext}>
            <View
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                width: SCREEN.width / 3,
                height: SCREEN.height,
              }}
            />
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
