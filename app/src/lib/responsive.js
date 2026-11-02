// Shared breakpoint for screens that need a real desktop-web layout (not
// just a stretched phone view) - the customer app exports to web/PWA as
// well as native, and some screens (product detail, vendor storefront) have
// a materially different two-column layout above this width, matching the
// desktop reference comps rather than just scaling the phone one up.
import { useWindowDimensions } from "react-native";

export const DESKTOP_BREAKPOINT = 860;

export const useIsDesktop = () => {
  const { width } = useWindowDimensions();
  return width >= DESKTOP_BREAKPOINT;
};
