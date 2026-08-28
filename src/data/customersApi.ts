import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { supabase } from "../supabase";
import { Customer } from "./customers";

dayjs.extend(utc);
dayjs.extend(timezone);

const MYT = "Asia/Kuala_Lumpur";

// Supabase stores snake_case columns; the app works with the camelCase
// `Customer` shape everywhere else, so we map both directions here.

type CustomerRow = {
  id: number;
  name: string;
  phone: string | null;
  member: boolean;
  package_name: string | null;
  package_price: number | null;
  sessions_total: number;
  sessions_used: number;
  happy_hour_locked: boolean | null;
  weekend_extra: boolean | null;
  public_holiday_extra: boolean | null;
  remark: string | null;
  coupon: number | null;
  gender: "M" | "F" | null;
  credit: number | null;
  points: number | null;
  created_at: string;
  last_visit_at: string | null;
  last_sale_amount: number | null;
  birthday: string | null;
};

const rowToCustomer = (row: CustomerRow): Customer => ({
  id: row.id,
  name: row.name,
  phone: row.phone || "",
  member: row.member,
  packageName: row.package_name || undefined,
  packagePrice: row.package_price ?? undefined,
  sessionsTotal: row.sessions_total ?? 0,
  sessionsUsed: row.sessions_used ?? 0,
  happyHourLocked: row.happy_hour_locked ?? undefined,
  weekendExtra: row.weekend_extra ?? undefined,
  publicHolidayExtra: row.public_holiday_extra ?? undefined,
  remark: row.remark || undefined,
  coupon: row.coupon ?? undefined,
  gender: row.gender || undefined,
  credit: row.credit ?? undefined,
  points: row.points ?? undefined,
  createdAt: row.created_at ? row.created_at.slice(0, 10) : undefined,
  lastVisitAt: row.last_visit_at || undefined,
  lastSaleAmount: row.last_sale_amount ?? undefined,
  birthday: row.birthday || undefined,
});

export const fetchCustomers = async (): Promise<Customer[]> => {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetchCustomers error:", error);
    return [];
  }

  return (data as CustomerRow[]).map(rowToCustomer);
};

export const insertCustomer = async (input: {
  name: string;
  phone?: string;
  gender?: "M" | "F";
}): Promise<Customer | null> => {
  const { data, error } = await supabase
    .from("customers")
    .insert({
      name: input.name,
      phone: input.phone || null,
      gender: input.gender || null,
      member: true,
      sessions_total: 0,
      sessions_used: 0,
      credit: 0,
      points: 0,
    })
    .select()
    .single();

  if (error) {
    console.error("insertCustomer error:", error);
    return null;
  }

  return rowToCustomer(data as CustomerRow);
};

export const updateCustomerSessionsUsed = async (
  customerId: number,
  sessionsUsed: number,
): Promise<void> => {
  const { error } = await supabase
    .from("customers")
    .update({ sessions_used: sessionsUsed })
    .eq("id", customerId);

  if (error) {
    console.error("updateCustomerSessionsUsed error:", error);
  }
};

export type MemberVisit = {
  id: number;
  customerId: number;
  type: "visit" | "topup" | "refund";
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  branch: string;
  therapistName?: string;
  description?: string;
  amount?: number;
};

type VisitRow = {
  id: number;
  customer_id: number;
  visit_type: "visit" | "topup" | "refund";
  visit_date: string;
  visit_time: string;
  branch: string | null;
  therapist_name: string | null;
  description: string | null;
  amount: number | null;
};

const rowToVisit = (row: VisitRow): MemberVisit => ({
  id: row.id,
  customerId: row.customer_id,
  type: row.visit_type,
  date: row.visit_date,
  time: row.visit_time,
  branch: row.branch || "Zenland Wellness",
  therapistName: row.therapist_name || undefined,
  description: row.description || undefined,
  amount: row.amount ?? undefined,
});

export const fetchMemberVisits = async (
  customerId: number,
): Promise<MemberVisit[]> => {
  const { data, error } = await supabase
    .from("member_visits")
    .select("*")
    .eq("customer_id", customerId)
    .order("visit_date", { ascending: false })
    .order("visit_time", { ascending: false });

  if (error) {
    console.error("fetchMemberVisits error:", error);
    return [];
  }

  return (data as VisitRow[]).map(rowToVisit);
};

export const logMemberVisit = async (input: {
  customerId: number;
  type: "visit" | "topup" | "refund";
  branch?: string;
  therapistName?: string;
  description?: string;
  amount?: number;
}): Promise<MemberVisit | null> => {
  const nowMYT = dayjs().tz(MYT);

  const { data, error } = await supabase
    .from("member_visits")
    .insert({
      customer_id: input.customerId,
      visit_type: input.type,
      visit_date: nowMYT.format("YYYY-MM-DD"),
      visit_time: nowMYT.format("HH:mm:ss"),
      branch: input.branch || "Zenland Wellness",
      therapist_name: input.therapistName || null,
      description: input.description || null,
      amount: input.amount ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("logMemberVisit error:", error);
    return null;
  }

  return rowToVisit(data as VisitRow);
};

export const updateCustomerCredit = async (
  customerId: number,
  credit: number,
): Promise<void> => {
  const { error } = await supabase
    .from("customers")
    .update({ credit })
    .eq("id", customerId);

  if (error) {
    console.error("updateCustomerCredit error:", error);
  }
};

// Recharges a member's prepaid credit wallet and logs it to the ledger.
export const topUpCustomerCredit = async (
  customer: Customer,
  amount: number,
  note?: string,
  newPackage?: { name: string; sessionsTotal: number },
): Promise<{ credit: number; packageName?: string; sessionsTotal?: number; sessionsUsed?: number } | null> => {
  const newCredit = (customer.credit || 0) + amount;

  const updatePayload: Record<string, unknown> = { credit: newCredit };

  if (newPackage?.name.trim()) {
    updatePayload.package_name = newPackage.name.trim();
    updatePayload.package_price = amount;
    updatePayload.sessions_total = newPackage.sessionsTotal;
    updatePayload.sessions_used = 0;
  }

  const { error } = await supabase
    .from("customers")
    .update(updatePayload)
    .eq("id", customer.id);

  if (error) {
    console.error("topUpCustomerCredit error:", error);
    return null;
  }

  const description = newPackage?.name.trim()
    ? `Top-up RM ${amount.toFixed(2)} — Package: ${newPackage.name.trim()} (${newPackage.sessionsTotal} sessions)${note ? ` · ${note}` : ""}`
    : note || `Top-up RM ${amount.toFixed(2)}`;

  await logMemberVisit({
    customerId: customer.id,
    type: "topup",
    amount,
    description,
  });

  return {
    credit: newCredit,
    ...(newPackage?.name.trim()
      ? {
          packageName: newPackage.name.trim(),
          sessionsTotal: newPackage.sessionsTotal,
          sessionsUsed: 0,
        }
      : {}),
  };
};

// Adds sessions to a member's package (re-top-up) and logs it to the visit history.
export const topUpCustomerPackage = async (
  customer: Customer,
  addSessions: number,
  amount: number,
  note?: string,
): Promise<boolean> => {
  const newTotal = (customer.sessionsTotal || 0) + addSessions;

  const { error } = await supabase
    .from("customers")
    .update({ sessions_total: newTotal })
    .eq("id", customer.id);

  if (error) {
    console.error("topUpCustomerPackage error:", error);
    return false;
  }

  await logMemberVisit({
    customerId: customer.id,
    type: "topup",
    description:
      note ||
      `Top-up +${addSessions} session${addSessions === 1 ? "" : "s"}${
        amount ? ` (RM ${amount})` : ""
      }`,
    amount,
  });

  return true;
};
