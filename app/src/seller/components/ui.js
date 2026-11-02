import React, { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme";

/**
 * Shared seller UI primitives.
 *
 * The native seller area started as inline-styled stubs. Everything here is a
 * direct translation of the vendor dashboard's visual language (cards, headers,
 * chips, badges, avatars, empty states) onto the customer app's theme tokens,
 * so every seller screen shares one density and rhythm.
 */

export function PageHeader({ title, subtitle, actionLabel, onAction, actionIcon = "add" }) {
  const { tokens } = useTheme();
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 24, fontWeight: "900", color: tokens.text.primary, letterSpacing: -0.6 }}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ fontSize: 13, color: tokens.text.muted, marginTop: 4, lineHeight: 19 }}>{subtitle}</Text>
          ) : null}
        </View>
        {actionLabel ? (
          <PrimaryButton label={actionLabel} icon={actionIcon} onPress={onAction} size="sm" />
        ) : null}
      </View>
    </View>
  );
}

export function Card({ children, style, padded = false }) {
  const { tokens } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: tokens.bg.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: tokens.border.default,
        },
        padded && { padding: 14 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionLabel({ children, style }) {
  const { tokens } = useTheme();
  return (
    <Text
      style={[
        {
          fontSize: 12,
          fontWeight: "700",
          color: tokens.text.muted,
          letterSpacing: 1,
          textTransform: "uppercase",
          marginBottom: 8,
          marginLeft: 4,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function SearchField({ value, onChangeText, placeholder = "Search..." }) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: tokens.bg.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: tokens.border.default,
        paddingHorizontal: 12,
        height: 44,
      }}
    >
      <Ionicons name="search" size={17} color={tokens.text.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.text.placeholder}
        style={{ flex: 1, fontSize: 14, color: tokens.text.primary }}
      />
      {value ? (
        <TouchableOpacity onPress={() => onChangeText("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close-circle" size={17} color={tokens.text.placeholder} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function FilterChips({ options, value, onChange }) {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <TouchableOpacity
            key={option.value || "all"}
            onPress={() => onChange(option.value)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: active ? tokens.brand.default : tokens.bg.surfaceMuted,
              borderWidth: 1,
              borderColor: active ? tokens.brand.default : tokens.border.default,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: active ? tokens.text.onBrand : tokens.text.muted,
              }}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function PrimaryButton({ label, icon, onPress, disabled, loading, variant = "primary", size = "md", style }) {
  const { tokens } = useTheme();
  const height = size === "sm" ? 38 : 46;
  const padding = size === "sm" ? 12 : 16;
  const tones = {
    primary: { backgroundColor: tokens.brand.default, color: tokens.text.onBrand, borderColor: tokens.brand.default },
    secondary: { backgroundColor: tokens.bg.surfaceMuted, color: tokens.text.primary, borderColor: tokens.border.default },
    soft: { backgroundColor: tokens.brand.soft, color: tokens.brand.strong, borderColor: tokens.brand.softBorder },
    danger: { backgroundColor: tokens.status.errorSoft, color: tokens.status.errorStrong, borderColor: tokens.status.errorSoftBorder },
  };
  const tone = tones[variant] || tones.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={[
        {
          height,
          paddingHorizontal: padding,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: tone.borderColor,
          backgroundColor: tone.backgroundColor,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
          opacity: disabled || loading ? 0.55 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tone.color} size="small" />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === "sm" ? 16 : 18} color={tone.color} /> : null}
          <Text style={{ color: tone.color, fontSize: size === "sm" ? 13 : 14, fontWeight: "700" }}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function EmptyState({ icon = "cube-outline", title, subtitle, actionLabel, onAction }) {
  const { tokens } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingHorizontal: 32, paddingVertical: 48 }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: tokens.bg.surfaceMuted,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <Ionicons name={icon} size={28} color={tokens.text.placeholder} />
      </View>
      <Text style={{ fontSize: 16, fontWeight: "800", color: tokens.text.primary, textAlign: "center" }}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ fontSize: 13, color: tokens.text.muted, textAlign: "center", marginTop: 6, lineHeight: 19 }}>
          {subtitle}
        </Text>
      ) : null}
      {actionLabel ? (
        <PrimaryButton label={actionLabel} onPress={onAction} size="sm" style={{ marginTop: 18 }} />
      ) : null}
    </View>
  );
}

export function Avatar({ name = "", size = 40 }) {
  const { tokens } = useTheme();
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tokens.brand.soft,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: tokens.brand.strong, fontWeight: "800", fontSize: size * 0.36 }}>
        {initials || "?"}
      </Text>
    </View>
  );
}

export function Thumb({ uri, size = 56, icon = "cube-outline" }) {
  const { tokens } = useTheme();
  const [broken, setBroken] = useState(false);
  if (!uri || broken) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          backgroundColor: tokens.bg.surfaceMuted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={size * 0.36} color={tokens.text.placeholder} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      onError={() => setBroken(true)}
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        backgroundColor: tokens.bg.surfaceMuted,
        borderWidth: 1,
        borderColor: tokens.border.default,
      }}
    />
  );
}

export function Badge({ label, tone = "neutral" }) {
  const { tokens } = useTheme();
  const tones = {
    brand: { bg: tokens.brand.soft, fg: tokens.brand.strong },
    success: { bg: tokens.status.successSoft, fg: tokens.status.successStrong },
    warning: { bg: tokens.status.warningSoft, fg: tokens.status.warningStrong },
    error: { bg: tokens.status.errorSoft, fg: tokens.status.errorStrong },
    info: { bg: tokens.status.infoSoft, fg: tokens.status.infoStrong },
    neutral: { bg: tokens.bg.surfaceMuted, fg: tokens.text.muted },
  };
  const { bg, fg } = tones[tone] || tones.neutral;
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
      <Text style={{ color: fg, fontSize: 10, fontWeight: "800", letterSpacing: 0.2 }}>{label}</Text>
    </View>
  );
}

export function StatTile({ icon, label, value, tone = "brand" }) {
  const { tokens } = useTheme();
  const tones = {
    brand: { bg: tokens.brand.soft, fg: tokens.brand.default },
    success: { bg: tokens.status.successSoft, fg: tokens.status.successStrong },
    info: { bg: tokens.status.infoSoft, fg: tokens.status.infoStrong },
    warning: { bg: tokens.status.warningSoft, fg: tokens.status.warningStrong },
  };
  const { bg, fg } = tones[tone] || tones.brand;
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tokens.bg.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: tokens.border.default,
        padding: 14,
        minWidth: 0,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: bg,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 10,
        }}
      >
        <Ionicons name={icon} size={17} color={fg} />
      </View>
      <Text style={{ fontSize: 20, fontWeight: "900", color: tokens.text.primary }} numberOfLines={1}>
        {value}
      </Text>
      <Text style={{ fontSize: 11, color: tokens.text.muted, marginTop: 2 }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function ListRow({ icon, title, subtitle, onPress, right, last = false }) {
  const { tokens } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 13,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: tokens.border.default,
      }}
    >
      {icon ? (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 11,
            backgroundColor: tokens.brand.soft,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Ionicons name={icon} size={18} color={tokens.brand.default} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14.5, fontWeight: "600", color: tokens.text.primary }}>{title}</Text>
        {subtitle ? (
          <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 1 }}>{subtitle}</Text>
        ) : null}
      </View>
      {right}
    </TouchableOpacity>
  );
}

export function LoadingState({ label = "Loading..." }) {
  const { tokens } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingVertical: 48 }}>
      <ActivityIndicator color={tokens.brand.default} />
      <Text style={{ color: tokens.text.muted, fontSize: 12, marginTop: 10 }}>{label}</Text>
    </View>
  );
}

export function relativeTime(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
