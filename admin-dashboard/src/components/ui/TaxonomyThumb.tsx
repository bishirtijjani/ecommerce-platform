import {
  Apple,
  Armchair,
  Baby,
  Banknote,
  BedDouble,
  Beef,
  Bike,
  Book,
  BookOpen,
  BrickWall,
  Briefcase,
  Brush,
  Bug,
  Building2,
  Bus,
  Cable,
  Cake,
  Camera,
  Candy,
  Car,
  CarFront,
  CookingPot,
  CupSoda,
  DoorOpen,
  Droplet,
  Droplets,
  Dumbbell,
  FlaskConical,
  Flower,
  FolderTree,
  Footprints,
  Gamepad2,
  Gem,
  Hammer,
  HeartPulse,
  House,
  Laptop,
  Layers,
  Leaf,
  Map,
  Moon,
  PawPrint,
  PartyPopper,
  Plane,
  PlugZap,
  Pill,
  Refrigerator,
  School,
  Scissors,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Smile,
  Sparkles,
  SprayCan,
  Sprout,
  Store,
  Sun,
  Truck,
  Tv,
  UtensilsCrossed,
  WashingMachine,
  Watch,
  Wind,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/cn';

/**
 * Square taxonomy thumbnail with graceful fallbacks: image -> icon -> generic
 * folder glyph. Used for both categories and subcategories everywhere so the
 * two dashboards read identically.
 *
 * `icon` values in the DB are glyph names (MaterialCommunityIcons names seeded
 * in the backend, plus a few Ionicons/lucide legacy names). This maps the known
 * names to lucide equivalents so the admin shows a real glyph instead of the
 * raw word; anything unrecognised falls back to a store icon. A literal emoji
 * (set via the admin emoji picker) is rendered as text.
 */

const ICON_MAP: Record<string, LucideIcon> = {
  // MaterialCommunityIcons / Ionicons names present in the catalog
  airplane: Plane,
  apple: Apple,
  armchair: Armchair,
  baby: Baby,
  basket: ShoppingBasket,
  bed: BedDouble,
  beef: Beef,
  bike: Bike,
  book: Book,
  'book-open': BookOpen,
  briefcase: Briefcase,
  build: Hammer,
  'building-2': Building2,
  bus: Bus,
  cable: Cable,
  cake: Cake,
  car: Car,
  'car-sport': CarFront,
  'cooking-pot': CookingPot,
  'cup-soda': CupSoda,
  'door-open': DoorOpen,
  droplet: Droplet,
  dumbbell: Dumbbell,
  flask: FlaskConical,
  flower: Flower,
  footprints: Footprints,
  'gamepad-2': Gamepad2,
  gem: Gem,
  'heart-pulse': HeartPulse,
  home: House,
  laptop: Laptop,
  layers: Layers,
  map: Map,
  moon: Moon,
  'paw-print': PawPrint,
  'phone-portrait': Smartphone,
  pill: Pill,
  restaurant: UtensilsCrossed,
  shirt: Shirt,
  'shopping-bag': ShoppingBag,
  sparkles: Sparkles,
  'spray-can': SprayCan,
  sprout: Sprout,
  store: Store,
  truck: Truck,
  tv: Tv,
  watch: Watch,
  wrench: Wrench,
  // Service trades
  'car-wrench': Wrench,
  'content-cut': Scissors,
  'pipe-wrench': Wrench,
  'electric-switch': PlugZap,
  broom: Brush,
  'hammer-screwdriver': Hammer,
  'hair-dryer': Wind,
  'face-woman': Smile,
  'washing-machine': WashingMachine,
  camera: Camera,
  'party-popper': PartyPopper,
  school: School,
  spa: Leaf,
  'truck-delivery': Truck,
  'car-wash': Droplets,
  'solar-panel': Sun,
  bug: Bug,
  wall: BrickWall,
  // Additional product categories
  fridge: Refrigerator,
  cellphone: Smartphone,
  candy: Candy,
  'cash-multiple': Banknote,
  'mortar-pestle': FlaskConical,
};

/** Anything with a character outside word/dash/space is treated as a glyph (emoji). */
const looksLikeGlyph = (value: string) => /[^a-zA-Z0-9\-_ ]/.test(value);

export const TaxonomyThumb = ({
  imageUrl,
  icon,
  size = 'md',
  className,
}: {
  imageUrl?: string | null;
  icon?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) => {
  const sizeClass = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-16 w-16' : 'h-10 w-10';
  const glyphClass = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-7 w-7' : 'h-5 w-5';
  const textClass = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-sm' : 'text-lg';

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        loading="lazy"
        className={cn(sizeClass, 'shrink-0 rounded-md border border-border object-cover', className)}
      />
    );
  }

  if (icon) {
    const Mapped = ICON_MAP[icon];
    if (Mapped) {
      return (
        <div
          aria-hidden="true"
          className={cn(
            sizeClass,
            'flex shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand-strong',
            className,
          )}
        >
          <Mapped className={glyphClass} />
        </div>
      );
    }
    if (looksLikeGlyph(icon)) {
      return (
        <div
          aria-hidden="true"
          className={cn(sizeClass, 'flex shrink-0 items-center justify-center rounded-md bg-brand-soft', textClass, className)}
        >
          {icon}
        </div>
      );
    }
    return (
      <div
        aria-hidden="true"
        className={cn(
          sizeClass,
          'flex shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand-strong',
          className,
        )}
      >
        <Store className={glyphClass} />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        sizeClass,
        'flex shrink-0 items-center justify-center rounded-md bg-bg-muted text-text-muted',
        className,
      )}
    >
      <FolderTree className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
    </div>
  );
};
