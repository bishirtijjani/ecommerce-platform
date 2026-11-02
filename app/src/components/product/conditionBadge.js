/**
 * Shared condition badge styling. One source of truth for the condition pill so
 * ProductCard, ListingCard and ProductDetailScreen all render identical colors:
 * green (successSoft) for New, amber (warningSoft) for Used, and the brand
 * tint for Second Hand (a marketplace-specific listing type, not just
 * pre-owned). Uses the theme's soft/strong tokens so it adapts to dark mode.
 */
export const conditionMeta = (tokens) => {
  const styles = {
    NEW: { bg: tokens.status.successSoft, text: tokens.status.successStrong, label: "NEW" },
    USED: { bg: tokens.status.warningSoft, text: tokens.status.warningStrong, label: "USED" },
    SECOND_HAND: { bg: tokens.brand.soft, text: tokens.brand.strong, label: "2ND HAND" },
  };
  const pick = (condition) => styles[condition] || styles.NEW;
  return {
    label: (condition) => pick(condition).label,
    bg: (condition) => pick(condition).bg,
    text: (condition) => pick(condition).text,
  };
};
