/**
 * SupportChatScreen - one ongoing in-app chat with the admin/support team.
 *
 * Backed by the support-ticket thread (the same inbox admins already answer
 * from): it opens the newest non-closed ticket, or an empty chat if there is
 * none. The first message auto-creates a ticket, so the user never fills a
 * form - they just talk. Replaces the old external WhatsApp/call buttons.
 */

import React, { useEffect, useMemo, useState } from "react";
import { goBackOr } from "../../lib/goBack";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { useTheme } from "../../theme";
import SignInPrompt from "../../components/SignInPrompt";
import SupportThread from "./SupportThread";
import {
  fetchMyTickets,
  fetchTicketDetail,
  createTicket,
  postTicketMessage,
  closeTicket,
  clearTicketDetail,
} from "../../store/slices/supportSlice";

export default function SupportChatScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { tokens, isDark } = useTheme();

  const { isAuthenticated, user } = useSelector((s) => s.auth);
  const { tickets, ticketDetail, ticketDetailLoading } = useSelector((s) => s.support);

  const [listLoaded, setListLoaded] = useState(false);
  const [posting, setPosting] = useState(false);
  const [closing, setClosing] = useState(false);

  // Load the ticket list once; then open the newest active thread if present.
  // Skipped entirely when signed out (the screen then shows a sign-in prompt,
  // and we must not fire an authenticated request that 401s).
  useEffect(() => {
    if (!isAuthenticated) {
      setListLoaded(true);
      return undefined;
    }
    let cancelled = false;
    dispatch(fetchMyTickets({}))
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setListLoaded(true);
      });
    return () => {
      cancelled = true;
      dispatch(clearTicketDetail());
    };
  }, [dispatch, isAuthenticated]);

  useEffect(() => {
    if (!listLoaded) return;
    const open = (tickets || []).find((tk) => tk.status !== "CLOSED");
    if (open) dispatch(fetchTicketDetail(open.id));
  }, [listLoaded]);

  const isClosed = ticketDetail?.status === "CLOSED";

  // The ticket's opening description renders as the first bubble, followed by
  // the back-and-forth messages.
  const messages = useMemo(() => {
    if (!ticketDetail) return [];
    const opening = ticketDetail.description
      ? [
          {
            id: `opening-${ticketDetail.id}`,
            fromUserId: ticketDetail.userId,
            body: ticketDetail.description,
            attachmentUrls: ticketDetail.attachmentUrls || [],
            createdAt: ticketDetail.createdAt,
            fromUser: ticketDetail.user,
          },
        ]
      : [];
    return [...opening, ...(ticketDetail.messages || [])];
  }, [ticketDetail]);

  const handleSubmit = async ({ body }) => {
    setPosting(true);
    try {
      if (ticketDetail) {
        await dispatch(postTicketMessage({ ticketId: ticketDetail.id, body })).unwrap();
      } else {
        // First message - start the conversation by creating the ticket.
        const subject = body.trim().slice(0, 60) || t("support.chat.defaultSubject");
        const created = await dispatch(
          createTicket({
            category: "OTHER",
            priority: "MEDIUM",
            subject,
            description: body,
            attachmentUrls: [],
          }),
        ).unwrap();
        await dispatch(fetchTicketDetail(created.id)).unwrap();
      }
    } catch (err) {
      Toast.show({ type: "error", text1: err?.message || t("support.sendFailed") });
    } finally {
      setPosting(false);
    }
  };

  const handleClose = () => {
    if (!ticketDetail) return;
    Alert.alert(t("support.closeTicketConfirm"), t("support.closeTicketBody"), [
      { text: t("photo.cancel"), style: "cancel" },
      {
        text: t("support.close"),
        style: "destructive",
        onPress: async () => {
          setClosing(true);
          try {
            await dispatch(closeTicket(ticketDetail.id)).unwrap();
            Toast.show({ type: "success", text1: t("support.ticketClosed") });
          } catch (err) {
            Toast.show({ type: "error", text1: err?.message });
          } finally {
            setClosing(false);
          }
        },
      },
    ]);
  };

  if (!isAuthenticated) {
    return <SignInPrompt icon="headset-outline" title={t("support.chat.signIn")} />;
  }

  const loading = !listLoaded || (ticketDetailLoading && !ticketDetail);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={tokens.bg.canvas} />
      <View style={{ height: 4, backgroundColor: tokens.brand.default }} />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: tokens.border.default,
          backgroundColor: tokens.bg.surface,
        }}
      >
        <TouchableOpacity
          onPress={() => goBackOr(navigation)}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.back")}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: tokens.bg.surfaceMuted,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Ionicons name="arrow-back" size={20} color={tokens.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text
            style={{ fontSize: 16, fontWeight: "800", color: tokens.text.primary }}
            accessibilityRole="header"
            numberOfLines={1}
          >
            {t("support.chat.title")}
          </Text>
          <Text style={{ fontSize: 11, color: tokens.text.muted }} numberOfLines={1}>
            {ticketDetail ? `${t("support.ticketNumber")} #${ticketDetail.number}` : t("support.chat.subtitle")}
          </Text>
        </View>
        {!loading && ticketDetail && !isClosed && (
          <TouchableOpacity
            onPress={handleClose}
            disabled={closing}
            accessibilityRole="button"
            accessibilityLabel={t("support.closeTicket")}
            style={{ padding: 8 }}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={tokens.text.muted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={tokens.brand.default} />
        </View>
      ) : (
        <SupportThread
          messages={messages}
          currentUserId={user?.id}
          canPost={!isClosed}
          posting={posting}
          onSubmit={handleSubmit}
          placeholder={t("support.chat.placeholder")}
        />
      )}
    </SafeAreaView>
  );
}
