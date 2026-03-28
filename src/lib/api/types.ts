// ---------------------------------------------------------------------------
// Enum mirrors — kept in sync with supabase/migrations/...init_schema.sql
// ---------------------------------------------------------------------------

export type TeamStatus =
  | "residential"
  | "local"
  | "out_of_state"
  | "international";

export type SpaceType = "block_scheduled" | "rink";
export type SeasonType = "winter" | "summer" | "year_round";
export type BookingStatus = "active" | "blocked" | "cancelled";
export type UserRole = "admin" | "team";

// ---------------------------------------------------------------------------
// API envelope — every route returns this shape
// ---------------------------------------------------------------------------

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  meta?: ApiMeta;
}

export interface ApiMeta {
  total?: number;
  generated_at: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Shared sub-shapes
// ---------------------------------------------------------------------------

export interface TeamSummary {
  id: string;
  name: string;
  status: TeamStatus;
}

export interface GroupSummary {
  id: string;
  name: string;
}

export interface TimeSlotSummary {
  id: string;
  label: string;
  start_time: string;
  end_time: string;
  sort_order: number;
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

export interface ScheduleBooking {
  id: string;
  slot_id: string | null;
  /** Direct start time — set only for rink (15-min) bookings */
  start_time: string | null;
  /** Direct end time — set only for rink (15-min) bookings */
  end_time: string | null;
  status: BookingStatus;
  block_reason: string | null;
  total_cost_cents: number;
  notes: string | null;
  team: TeamSummary | null;
  group: GroupSummary | null;
  /** Resolved time slot row — null for rink bookings */
  time_slot: {
    id: string;
    label: string;
    slot_start: string;
    slot_end: string;
  } | null;
}

export interface ScheduleLane {
  id: string;
  name: string;
  sort_order: number;
  bookings: ScheduleBooking[];
}

export interface ScheduleSpace {
  id: string;
  name: string;
  space_type: SpaceType;
  season: SeasonType;
  lanes: ScheduleLane[];
}

export interface ScheduleData {
  date: string;
  spaces: ScheduleSpace[];
}

// ---------------------------------------------------------------------------
// Booking detail / list
// ---------------------------------------------------------------------------

export interface BookingDetail {
  id: string;
  lane_id: string;
  space_id: string;
  booking_date: string;
  slot_id: string | null;
  start_time: string | null;
  end_time: string | null;
  team_id: string | null;
  group_id: string | null;
  status: BookingStatus;
  block_reason: string | null;
  total_cost_cents: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  lane: { id: string; name: string } | null;
  space: { id: string; name: string; space_type: SpaceType } | null;
  team: TeamSummary | null;
  group: GroupSummary | null;
  time_slot: TimeSlotSummary | null;
}

// ---------------------------------------------------------------------------
// Invoice
// ---------------------------------------------------------------------------

export interface InvoiceLineItem {
  booking_id: string;
  booking_date: string;
  space_name: string;
  lane_name: string;
  /** Slot label for block-scheduled lanes, null for rink */
  slot_label: string | null;
  /** Direct times for rink lanes, null for block-scheduled */
  start_time: string | null;
  end_time: string | null;
  group_name: string | null;
  unit_rate_cents: number;
  /** 1 for block-scheduled; number of 15-min increments for rink */
  quantity: number;
  /** unit_rate_cents * quantity — the stored booking total (pre-discount) */
  subtotal_cents: number;
  discount_amount_cents: number;
  total_cents: number;
}

export interface TeamInvoice {
  team: TeamSummary & { active: boolean };
  period: { month: number; year: number; label: string };
  discount_percent: number;
  line_items: InvoiceLineItem[];
  subtotal_cents: number;
  discount_total_cents: number;
  grand_total_cents: number;
}

export interface InvoiceSummary {
  team: TeamSummary;
  period: { month: number; year: number; label: string };
  booking_count: number;
  subtotal_cents: number;
  discount_percent: number;
  grand_total_cents: number;
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

export interface TeamDetail {
  id: string;
  name: string;
  status: TeamStatus;
  active: boolean;
  notes: string | null;
  created_at: string;
}

export interface SpaceDetail {
  id: string;
  name: string;
  space_type: SpaceType;
  season: SeasonType;
  active: boolean;
  notes: string | null;
  lanes: LaneDetail[];
  time_slots: TimeSlotSummary[];
}

export interface LaneDetail {
  id: string;
  space_id: string;
  name: string;
  sort_order: number;
  active: boolean;
  notes: string | null;
}
