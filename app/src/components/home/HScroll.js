import React, { useState } from "react";
import { View, ScrollView, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../theme";

// Wraps a horizontal ScrollView with edge fade-out gradients and a "there's
// more" chevron hint on the right, so users notice these rows scroll. The
// fades use the active theme's canvas color so they blend into the screen
// background in both light and dark mode.
export default function HScroll({ contentContainerStyle, children, data, renderItem, keyExtractor }) {
  const { tokens } = useTheme();
  const [scrollX, setScrollX] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  const canScrollLeft = scrollX > 4;
  const canScrollRight = contentWidth - containerWidth - scrollX > 4;
  const fadeColor = tokens.bg.canvas;

  const scrollProps = {
    horizontal: true,
    showsHorizontalScrollIndicator: false,
    contentContainerStyle,
    onLayout: (e) => setContainerWidth(e.nativeEvent.layout.width),
    onContentSizeChange: (w) => setContentWidth(w),
    onScroll: (e) => setScrollX(e.nativeEvent.contentOffset.x),
    scrollEventThrottle: 16,
  };

  return (
    <View>
      {data ? (
        <FlatList
          {...scrollProps}
          data={data}
          keyExtractor={keyExtractor}
          renderItem={({ item }) => renderItem(item)}
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          windowSize={5}
        />
      ) : (
        <ScrollView {...scrollProps}>{children}</ScrollView>
      )}
      {canScrollLeft && (
        <LinearGradient
          colors={[fadeColor, `${fadeColor}00`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          pointerEvents="none"
          style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 28 }}
        />
      )}
      {canScrollRight && (
        <>
          <LinearGradient
            colors={[`${fadeColor}00`, fadeColor]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            pointerEvents="none"
            style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 36 }}
          />
          <View
            pointerEvents="none"
            style={{ position: "absolute", right: 4, top: 0, bottom: 0, justifyContent: "center" }}
          >
            <View
              className="w-5 h-5 rounded-full items-center justify-center"
              style={{ backgroundColor: tokens.bg.surface, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 3, elevation: 2 }}
            >
              <Ionicons name="chevron-forward" size={13} color={tokens.brand.default} />
            </View>
          </View>
        </>
      )}
    </View>
  );
}