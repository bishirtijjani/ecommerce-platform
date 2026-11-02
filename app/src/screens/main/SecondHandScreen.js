import MarketScreen from "./MarketScreen";

const BANNER_IMG = {
  uri: "https://images.unsplash.com/photo-1553413077-190dd305871c?w=1000&q=60",
};

// The Second Hand marketplace is a cross-vendor view of every SECOND_HAND
// listing (any seller), browsed by Nigerian State then LGA. Listings inherit
// the seller's State/LGA, so no single vendor is involved.
export default function SecondHandScreen(props) {
  return (
    <MarketScreen
      {...props}
      condition="SECOND_HAND"
      name="Second Hand Items"
      emoji="🔄"
      subtitle="Quality pre-owned items at giveaway prices"
      bannerImage={BANNER_IMG}
      locationMode
    />
  );
}
