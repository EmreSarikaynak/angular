export type Sex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Goal = "lose" | "maintain" | "gain";
export type Meal = "breakfast" | "lunch" | "dinner" | "snack" | "night" | "drink";
export type Intensity = "low" | "moderate" | "high";
export type Lang = "tr" | "en";
export type Theme = "system" | "light" | "dark";
export type EntrySource = "photo" | "text" | "barcode" | "label" | "manual" | "favorite" | "drink";
export type DataSource = "reference" | "ai" | "openfoodfacts" | "label" | "user";

export const MEALS: Meal[] = ["breakfast", "lunch", "dinner", "snack", "night", "drink"];

export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  sex: Sex | null;
  height_cm: number | null;
  start_weight_kg: number | null;
  weight_kg: number | null;
  target_weight_kg: number | null;
  activity_level: ActivityLevel | null;
  goal: Goal | null;
  weekly_rate_kg: number;
  allergies: string[];
  diet_preferences: string[];
  kcal_target: number | null;
  protein_target_g: number | null;
  carbs_target_g: number | null;
  fat_target_g: number | null;
  water_target_ml: number | null;
  steps_target: number;
  targets_custom: boolean;
  add_exercise_calories: boolean;
  store_photos: boolean;
  language: Lang;
  theme: Theme;
  timezone: string;
  reminder_enabled: boolean;
  reminder_interval_min: number;
  reminder_start_hour: number;
  reminder_end_hour: number;
  notify_supplements: boolean;
  supplement_nag_min: number;
  notify_protein: boolean;
  protein_check_hour: number;
  notify_insights: boolean;
  notify_summary: boolean;
  notify_evening: boolean;
  evening_hour: number;
  fasting_target_hours: number;
  onboarded_at: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Nutrients {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sugar_g: number;
  fiber_g: number;
  salt_g: number;
  alcohol_g: number;
}

export interface FoodEntry extends Nutrients {
  id: string;
  user_id?: string;
  entry_date: string;
  consumed_at: string;
  meal: Meal;
  name: string;
  quantity: number | null;
  unit: string | null;
  grams: number | null;
  source: EntrySource;
  data_source: DataSource;
  is_estimated: boolean;
  confidence: number | null;
  photo_path: string | null;
  group_id: string | null;
  group_name: string | null;
  drink_type: string | null;
  volume_ml: number | null;
  abv: number | null;
  caffeine_mg?: number;
  note: string | null;
  created_at?: string;
}

export interface WaterLog {
  id: string;
  user_id?: string;
  entry_date: string;
  logged_at: string;
  amount_ml: number;
}

export interface Activity {
  id: string;
  user_id?: string;
  entry_date: string;
  started_at: string;
  type: string;
  name: string | null;
  duration_min: number;
  distance_km: number | null;
  intensity: Intensity;
  met: number | null;
  kcal_burned: number;
  note: string | null;
}

export interface DailyLog {
  id: string;
  user_id?: string;
  entry_date: string;
  steps: number | null;
  sleep_hours: number | null;
  sleep_quality: number | null;
  mood: number | null;
  energy: number | null;
  stress: number | null;
  note: string | null;
}

export interface BodyMeasurement {
  id: string;
  user_id?: string;
  entry_date: string;
  weight_kg: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  chest_cm: number | null;
  body_fat_pct: number | null;
  bmi: number | null;
  note: string | null;
}

/** Analiz sonucundaki ya da favorideki tek bir yiyecek kalemi. */
export interface FoodItem extends Nutrients {
  name: string;
  quantity: number | null;
  unit: string | null;
  grams: number | null;
  confidence: number | null;
  is_estimated: boolean;
  data_source: DataSource;
}

export interface Favorite {
  id: string;
  user_id?: string;
  name: string;
  items: FoodItem[];
  use_count: number;
  created_at?: string;
}

export interface ChatMessage {
  id: string;
  user_id?: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface AnalysisResult {
  is_food: boolean;
  dish_name: string;
  items: FoodItem[];
  overall_confidence: number;
  needs_clarification: boolean;
  clarification_question: string | null;
  notes: string | null;
  cached?: boolean;
}

export const EMPTY_NUTRIENTS: Nutrients = {
  kcal: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  sugar_g: 0,
  fiber_g: 0,
  salt_g: 0,
  alcohol_g: 0,
};

export const NUTRIENT_KEYS = [
  "kcal",
  "protein_g",
  "carbs_g",
  "fat_g",
  "sugar_g",
  "fiber_g",
  "salt_g",
  "alcohol_g",
] as const satisfies readonly (keyof Nutrients)[];

export interface Supplement {
  id: string;
  user_id?: string;
  name: string;
  dose: string | null;
  times: string[];
  active: boolean;
  note: string | null;
  /** Kutuda kalan adet; null = stok takip edilmiyor. */
  stock_count?: number | null;
  per_dose?: number;
  created_at?: string;
}

export interface SupplementLog {
  id: string;
  user_id?: string;
  supplement_id: string;
  entry_date: string;
  time_slot: string;
  taken_at: string;
}

export interface HealthRing {
  id: string;
  user_id?: string;
  entry_date: string;
  move_kcal: number | null;
  move_goal: number | null;
  exercise_min: number | null;
  exercise_goal: number | null;
  stand_hours: number | null;
  stand_goal: number | null;
  steps: number | null;
  distance_km: number | null;
  source: "manual" | "screenshot";
}

export interface FastingSession {
  id: string;
  user_id?: string;
  entry_date: string;
  started_at: string;
  ended_at: string | null;
  target_hours: number;
}

export interface PlanMeal {
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface MealPlanData {
  days: { day: number; meals: PlanMeal[] }[];
  shopping: { category: string; items: string[] }[];
}

export interface MealPlan {
  id: string;
  user_id?: string;
  entry_date: string;
  plan: MealPlanData;
  checked: string[];
  created_at?: string;
}

export interface ShareLink {
  id: string;
  user_id?: string;
  label: string | null;
  days: 7 | 30 | 90;
  include_meals: boolean;
  include_body: boolean;
  include_wellbeing: boolean;
  expires_at: string;
  revoked_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
  created_at: string;
}
