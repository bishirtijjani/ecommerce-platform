import MarketScreen from "./MarketScreen";
import { MARKET_VENDORS } from "../../components/home/homeData";

const BANNER_IMG = require("../../../assets/banners/arab-world.png");

export default function ArabWorldScreen(props) {
  return (
    <MarketScreen
      {...props}
      vendorId={MARKET_VENDORS.arab}
      name="Arab World"
      emoji="🌍"
      subtitle="Products from trusted sellers across the Arab world"
      bannerImage={BANNER_IMG}
    />
  );
}
