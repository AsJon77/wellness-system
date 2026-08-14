export interface Customer {
  id: number;
  name: string;
  phone: string;
  member: boolean;
  packageName?: string;
  packagePrice?: number;
  sessionsTotal: number;
  sessionsUsed: number;
  happyHourLocked?: boolean;
  weekendExtra?: boolean;
  publicHolidayExtra?: boolean;
  remark?: string;
  coupon?: number;

  // --- Member module additions ---
  gender?: "M" | "F";
  credit?: number; // stored credit balance (RM)
  points?: number; // loyalty points
  createdAt?: string; // ISO date, used for "New" tab
  lastVisitAt?: string; // ISO datetime, used for "Recent" tab / sort
  lastSaleAmount?: number; // RM of most recent sale, shown on the list card
  birthday?: string; // "MM-DD", used for "Birthday" tab
}

// Real member data now lives in Supabase (`customers` table).
// See src/data/customersApi.ts for fetch/insert/update functions,
// and supabase_customers_migration.sql for the table + seed data.
