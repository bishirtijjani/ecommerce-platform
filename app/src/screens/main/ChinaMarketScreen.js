import MarketScreen from "./MarketScreen";
import { MARKET_VENDORS } from "../../components/home/homeData";

const BANNER_IMG = require("../../../assets/banners/china-market.png");

export default function ChinaMarketScreen(props) {
  return (
    <MarketScreen
      {...props}
      vendorId={MARKET_VENDORS.china}
      name="China Market"
      emoji="🇨🇳"
      subtitle="Quality products directly from trusted Chinese sellers"
      bannerImage={BANNER_IMG}
    />
  );
}
