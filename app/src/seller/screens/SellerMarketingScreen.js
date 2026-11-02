import React, { useState } from "react";
import { Modal, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme";
import { formatNaira } from "../../data/marketplace";
import { useDiscountCodes, useCreateDiscountCode, useVendorCampaigns, useCreateCampaign } from "../hooks/useSeller";
import { Badge, Card, EmptyState, PageHeader, PrimaryButton, SectionLabel } from "../components/ui";

const STATUS_TONE = { APPROVED: "success", REJECTED: "error", PENDING: "warning" };

const inputStyle = (tokens) => ({
  backgroundColor: tokens.bg.surfaceMuted,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: tokens.border.default,
  paddingHorizontal: 12,
  paddingVertical: 11,
  color: tokens.text.primary,
  fontSize: 14,
});

export default function SellerMarketingScreen() {
  const { tokens } = useTheme();
  const { data: discounts, isLoading, refetch: refetchDiscounts } = useDiscountCodes();
  const { data: campaigns, refetch: refetchCampaigns } = useVendorCampaigns();
  const createDiscount = useCreateDiscountCode();
  const createCampaign = useCreateCampaign();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", type: "percentage", value: "", minOrder: "", usageLimit: "100" });
  const [campaignName, setCampaignName] = useState("");
  const [campaignBudget, setCampaignBudget] = useState("");

  const discountsList = Array.isArray(discounts) ? discounts : discounts?.data || [];
  const campaignsList = Array.isArray(campaigns) ? campaigns : campaigns?.data || [];

  const submit = () => {
    if (!form.code.trim() || !form.value) return;
    createDiscount.mutate(
      {
        code: form.code.trim().toUpperCase(),
        type: form.type,
        value: Number(form.value),
        minOrder: form.minOrder ? Number(form.minOrder) : undefined,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setForm({ code: "", type: "percentage", value: "", minOrder: "", usageLimit: "100" });
        },
      }
    );
  };

  const createCampaignNow = () => {
    if (campaignName.trim().length < 3) return;
    createCampaign.mutate({
      name: campaignName.trim(),
      budget: campaignBudget ? Number(campaignBudget) : undefined,
    });
    setCampaignName("");
    setCampaignBudget("");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <ScrollView
        style={{ width: "100%", maxWidth: 960, alignSelf: "center" }}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => {
              refetchDiscounts();
              refetchCampaigns();
            }}
            tintColor={tokens.brand.default}
          />
        }
      >
        <PageHeader
          title="Marketing"
          subtitle="Discount codes and campaigns that bring customers back."
          actionLabel="Discount"
          onAction={() => setOpen(true)}
        />

        <View style={{ paddingHorizontal: 16 }}>
          <SectionLabel>Discount codes</SectionLabel>
          {discountsList.length === 0 ? (
            <Card>
              <EmptyState
                icon="pricetag-outline"
                title="No discount codes yet"
                subtitle="Create a code to reward repeat customers or clear old stock."
                actionLabel="Create discount"
                onAction={() => setOpen(true)}
              />
            </Card>
          ) : (
            discountsList.map((code) => (
              <Card key={code.id} style={{ padding: 14, marginBottom: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 11,
                        backgroundColor: tokens.brand.soft,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="pricetag-outline" size={17} color={tokens.brand.default} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: "900", color: tokens.text.primary, letterSpacing: 0.6 }}>
                        {code.code}
                      </Text>
                      <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 1 }}>
                        {code.type === "percentage" ? `${code.value}% off` : `${formatNaira(code.value)} off`}
                        {code.minOrder ? ` · min ${formatNaira(code.minOrder)}` : ""}
                      </Text>
                    </View>
                  </View>
                  <Badge label={code.status || "PENDING"} tone={STATUS_TONE[code.status] || "neutral"} />
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: 12,
                    paddingTop: 10,
                    borderTopWidth: 1,
                    borderTopColor: tokens.border.default,
                  }}
                >
                  <Text style={{ fontSize: 11.5, color: tokens.text.muted }}>
                    Used {code.used || 0} / {code.usageLimit || 0}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: tokens.text.placeholder }}>
                    {code.createdAt ? new Date(code.createdAt).toLocaleDateString() : ""}
                  </Text>
                </View>
              </Card>
            ))
          )}

          <SectionLabel style={{ marginTop: 18 }}>Campaigns</SectionLabel>
          <Card padded style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                value={campaignName}
                onChangeText={setCampaignName}
                placeholder="Campaign name"
                placeholderTextColor={tokens.text.placeholder}
                style={[inputStyle(tokens), { flex: 1 }]}
              />
              <TextInput
                value={campaignBudget}
                onChangeText={setCampaignBudget}
                placeholder="Budget ₦"
                keyboardType="numeric"
                placeholderTextColor={tokens.text.placeholder}
                style={[inputStyle(tokens), { width: 104 }]}
              />
            </View>
            <PrimaryButton
              label="Create campaign"
              icon="megaphone-outline"
              size="sm"
              onPress={createCampaignNow}
              disabled={campaignName.trim().length < 3}
              style={{ marginTop: 10 }}
            />
          </Card>

          {campaignsList.length === 0 ? (
            <Card>
              <EmptyState
                icon="megaphone-outline"
                title="No campaigns yet"
                subtitle="Log a promotion above to track its budget and status."
              />
            </Card>
          ) : (
            campaignsList.map((campaign) => (
              <Card key={campaign.id} style={{ padding: 14, marginBottom: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 14.5, fontWeight: "700", color: tokens.text.primary }}>
                    {campaign.name}
                  </Text>
                  <Badge
                    label={campaign.status ? campaign.status.toUpperCase() : "DRAFT"}
                    tone={campaign.status === "active" ? "success" : "neutral"}
                  />
                </View>
                <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 4 }}>
                  {campaign.budget ? `Budget ${formatNaira(campaign.budget)}` : "No budget set"}
                  {campaign.type ? ` · ${campaign.type}` : ""}
                </Text>
              </Card>
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: tokens.overlay.scrimSoft }} activeOpacity={1} onPress={() => setOpen(false)} />
          <View
            style={{
              backgroundColor: tokens.bg.surface,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              padding: 20,
              paddingBottom: 28,
            }}
          >
            <View style={{ alignItems: "center", marginBottom: 10 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: tokens.border.strong }} />
            </View>
            <Text style={{ fontSize: 19, fontWeight: "900", color: tokens.text.primary, marginBottom: 14 }}>
              New discount code
            </Text>

            <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, marginBottom: 6 }}>Code</Text>
            <TextInput
              value={form.code}
              onChangeText={(v) => setForm({ ...form, code: v })}
              placeholder="e.g. WELCOME10"
              placeholderTextColor={tokens.text.placeholder}
              autoCapitalize="characters"
              style={[inputStyle(tokens), { marginBottom: 10 }]}
            />

            <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, marginBottom: 6 }}>Type</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
              {[
                { value: "percentage", label: "Percentage" },
                { value: "fixed", label: "Fixed amount" },
              ].map((option) => {
                const active = form.type === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => setForm({ ...form, type: option.value })}
                    style={{
                      flex: 1,
                      backgroundColor: active ? tokens.brand.default : tokens.bg.surfaceMuted,
                      borderWidth: 1,
                      borderColor: active ? tokens.brand.default : tokens.border.default,
                      paddingVertical: 11,
                      borderRadius: 10,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: active ? tokens.text.onBrand : tokens.text.primary, fontWeight: "700", fontSize: 13 }}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, marginBottom: 6 }}>
                  {form.type === "percentage" ? "Percent off" : "Amount off"}
                </Text>
                <TextInput
                  value={form.value}
                  onChangeText={(v) => setForm({ ...form, value: v })}
                  placeholder={form.type === "percentage" ? "10" : "1000"}
                  keyboardType="numeric"
                  placeholderTextColor={tokens.text.placeholder}
                  style={inputStyle(tokens)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, marginBottom: 6 }}>Min order</Text>
                <TextInput
                  value={form.minOrder}
                  onChangeText={(v) => setForm({ ...form, minOrder: v })}
                  placeholder="Optional"
                  keyboardType="numeric"
                  placeholderTextColor={tokens.text.placeholder}
                  style={inputStyle(tokens)}
                />
              </View>
            </View>

            <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, marginBottom: 6 }}>Usage limit</Text>
            <TextInput
              value={form.usageLimit}
              onChangeText={(v) => setForm({ ...form, usageLimit: v })}
              placeholder="100"
              keyboardType="numeric"
              placeholderTextColor={tokens.text.placeholder}
              style={[inputStyle(tokens), { marginBottom: 16 }]}
            />

            <View style={{ flexDirection: "row", gap: 8 }}>
              <PrimaryButton label="Cancel" variant="secondary" onPress={() => setOpen(false)} style={{ flex: 1 }} />
              <PrimaryButton
                label="Create code"
                onPress={submit}
                disabled={!form.code.trim() || !form.value}
                loading={createDiscount.isPending}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
