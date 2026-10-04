import {
  ArrowLeftRight,
  Baby,
  Banknote,
  BookOpen,
  Briefcase,
  Bus,
  Car,
  CircleEllipsis,
  Clapperboard,
  Coffee,
  CreditCard,
  Dumbbell,
  Fuel,
  Gift,
  Globe,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Music,
  PawPrint,
  Percent,
  Phone,
  PiggyBank,
  Scale,
  Pill,
  Plane,
  Receipt,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  TrendingUp,
  Undo2,
  Utensils,
  Wallet,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { isIconName, type IconName } from "@/lib/icon-names";

const ICONS: Record<IconName, LucideIcon> = {
  utensils: Utensils,
  coffee: Coffee,
  "shopping-basket": ShoppingBasket,
  "shopping-bag": ShoppingBag,
  shirt: Shirt,
  bus: Bus,
  car: Car,
  fuel: Fuel,
  plane: Plane,
  house: House,
  receipt: Receipt,
  zap: Zap,
  wifi: Wifi,
  phone: Phone,
  "heart-pulse": HeartPulse,
  pill: Pill,
  dumbbell: Dumbbell,
  clapperboard: Clapperboard,
  music: Music,
  "book-open": BookOpen,
  "graduation-cap": GraduationCap,
  gift: Gift,
  baby: Baby,
  "paw-print": PawPrint,
  wrench: Wrench,
  sparkles: Sparkles,
  briefcase: Briefcase,
  "undo-2": Undo2,
  percent: Percent,
  "piggy-bank": PiggyBank,
  "trending-up": TrendingUp,
  banknote: Banknote,
  landmark: Landmark,
  smartphone: Smartphone,
  "credit-card": CreditCard,
  globe: Globe,
  wallet: Wallet,
  "circle-ellipsis": CircleEllipsis,
};

/** Icons used by the app itself (not offered in the category icon picker). */
const SYSTEM_ICONS: Record<string, LucideIcon> = {
  transfer: ArrowLeftRight,
  adjustment: Scale,
};

export function AppIcon({
  name,
  className,
  fallback = "circle-ellipsis",
}: {
  name: string | null | undefined;
  className?: string;
  fallback?: IconName;
}) {
  const Icon: LucideIcon = isIconName(name) ? ICONS[name] : ((name ? SYSTEM_ICONS[name] : undefined) ?? ICONS[fallback]);
  return <Icon className={className} aria-hidden />;
}

/** A tinted round badge holding an icon, used for categories, accounts and payment methods. */
export function IconBadge({
  icon,
  color,
  className,
}: {
  icon: string | null | undefined;
  color?: string | null;
  className?: string;
}) {
  return (
    <span
      className={cn("flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground", className)}
      style={color ? { backgroundColor: `${color}22`, color } : undefined}
    >
      <AppIcon name={icon} className="size-5" />
    </span>
  );
}
