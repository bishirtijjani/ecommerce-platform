import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "../../theme";

const TONES = {
  PENDING: "warning",
  ACCEPTED: "info",
  PROCESSING: "info",
  SHIPPED: "info",
  DELIVERED: "success",
  CANCELLED: "error",
  REJECTED: "error",
};

const LABELS = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REJECTED: "Rejected",
};

export default function OrderStatusBadge({ status }) {
  const { tokens } = useTheme();
  const tone = TONES[status] || "neutral";
  const palette = {
    warning: { bg: tokens.status.warningSoft, fg: tokens.status.warningStrong, dot: tokens.status.warning },
    info: { bg: tokens.status.infoSoft, fg: tokens.status.infoStrong, dot: tokens.status.info },
    success: { bg: tokens.status.successSoft, fg: tokens.status.successStrong, dot: tokens.status.success },
    error: { bg: tokens.status.errorSoft, fg: tokens.status.errorStrong, dot: tokens.status.error },
    neutral: { bg: tokens.bg.surfaceMuted, fg: tokens.text.muted, dot: tokens.text.placeholder },
  }[tone];

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        backgroundColor: palette.bg,
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 999,
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette.dot }} />
      <Text style={{ color: palette.fg, fontSize: 11, fontWeight: "700" }}>
        {LABELS[status] || status || "Unknown"}
      </Text>
    </View>
  );
}
