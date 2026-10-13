import {
  BookOpen,
  Briefcase,
  CalendarDays,
  Car,
  Church,
  Coffee,
  Dumbbell,
  GraduationCap,
  Moon,
  Rocket,
  ShowerHead,
  Snowflake,
  Sparkles,
  Sprout,
  Sunrise,
  Sunset,
  Users,
  UtensilsCrossed,
  Volleyball,
  type LucideIcon,
} from "lucide-react";
import type { BlockKind, Journey } from "../planner";

export const JOURNEY_ICON: Record<Journey, LucideIcon> = {
  // 'body' is Stewardship; 'sport' is Athletics (Oct 12).
  body: Sprout,
  sport: Dumbbell,
  shs: Rocket,
  school: GraduationCap,
  faith: Church,
  life: Users,
};

export const KIND_ICON: Record<BlockKind, LucideIcon> = {
  anchor_cold_shower: Snowflake,
  anchor_walk: Sunrise,
  shs_floor: Rocket,
  breakfast: Coffee,
  meal: UtensilsCrossed,
  class: GraduationCap,
  event: CalendarDays,
  practice: Volleyball,
  library_work: BookOpen,
  work: Briefcase,
  workout: Dumbbell,
  shower: ShowerHead,
  misc: Sparkles,
  travel: Car,
  buffer: Sparkles,
  winddown: Sunset,
  bed: Moon,
};
