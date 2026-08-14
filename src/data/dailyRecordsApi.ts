import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { supabase } from "../supabase";
import { getMassagePackageDuration } from "./massagePackages";

dayjs.extend(utc);
dayjs.extend(timezone);

const MYT = "Asia/Kuala_Lumpur";

// Mirrors the Entry / TherapistBox shape defined in TherapistTable.tsx.
// Field names must stay in sync with that file since they share the
// same `daily_records.data` JSON blob in Supabase.

export type DailyEntry = {
  timeIn: string;
  timeOut: string;
  customerName: string;
  remainingSessions?: number;
  packageName: string;
  rm: number | string;
  coupon: number | string;
  oil: string;
  total: number;
  payment: string;
  laundry: string;
  note: string;
};

export type DailyTherapistBox = {
  id: number;
  title: string;
  entries: DailyEntry[];
};

const TIME_FORMAT = "HH:mm";

/** Returns today's date in Malaysia time as YYYY-MM-DD. */
export const todayMYT = () => dayjs().tz(MYT).format("YYYY-MM-DD");

/** Fetches the full daily_records row (all therapist boxes/entries) for a
 *  given date, used by the History page to compute collection totals. */
export const fetchDailyRecordForDate = async (
  date: string,
): Promise<DailyTherapistBox[]> => {
  const { data, error } = await supabase
    .from("daily_records")
    .select("*")
    .eq("date", date)
    .maybeSingle();

  if (error) {
    console.error("fetchDailyRecordForDate error:", error);
    return [];
  }

  return data?.data?.therapists || [];
};

const getCurrentTimeIn = () => {
  const now = dayjs().tz(MYT);
  const roundedMinutes = Math.floor(now.minute() / 5) * 5;

  return now.minute(roundedMinutes).second(0).millisecond(0).format(TIME_FORMAT);
};

/** Returns the list of non-empty therapist titles already on today's sheet,
 *  used to populate the "select or type" therapist field on the Form. */
export const fetchTherapistTitlesForDate = async (
  date: string,
): Promise<string[]> => {
  const { data, error } = await supabase
    .from("daily_records")
    .select("data")
    .eq("date", date)
    .maybeSingle();

  if (error || !data) return [];

  const therapists: DailyTherapistBox[] = data.data?.therapists || [];

  return therapists.map((t) => (t.title || "").trim()).filter(Boolean);
};

/**
 * Adds a brand-new, empty therapist box to today's daily_records — used by
 * the Orders page's "+ Add Therapist" flow. Creates the day's record if it
 * doesn't exist yet.
 */
export const addTherapistToDate = async (
  date: string,
  title: string,
): Promise<{ success: boolean; error?: string }> => {
  const cleanTitle = title.trim().toUpperCase();
  if (!cleanTitle) return { success: false, error: "Enter a therapist name" };

  const { data, error } = await supabase
    .from("daily_records")
    .select("*")
    .eq("date", date)
    .maybeSingle();

  if (error) return { success: false, error: error.message };

  const therapists: DailyTherapistBox[] = data?.data?.therapists || [];
  const summary = data?.data?.summary || { laundry: "", note: "" };

  if (therapists.some((t) => t.title.trim().toUpperCase() === cleanTitle)) {
    return { success: false, error: `${cleanTitle} is already on today's sheet.` };
  }

  const nextId = therapists.length
    ? Math.max(...therapists.map((t) => t.id)) + 1
    : 1;

  const updatedTherapists = [...therapists, { id: nextId, title: cleanTitle, entries: [] }];

  const { error: upsertError } = await supabase.from("daily_records").upsert(
    { date, data: { therapists: updatedTherapists, summary } },
    { onConflict: "date" },
  );

  if (upsertError) return { success: false, error: upsertError.message };

  return { success: true };
};

/**
 * Adds a new entry directly to an already-existing therapist box for the
 * given date, with a chosen payment type. Used by the Orders page so staff
 * can log a booking without opening the Daily System table at all.
 * Unlike attachMemberVisitToTherapist, this never creates a new therapist
 * box — the therapist must already exist on today's sheet.
 */
export const attachOrderToTherapist = async (params: {
  date: string;
  therapistId: number;
  customerName: string;
  packageCode: string;
  rm: number;
  coupon: number;
  oil: number;
  payment: string;
}): Promise<{ success: boolean; error?: string }> => {
  const { date, therapistId, customerName, packageCode, rm, coupon, oil, payment } =
    params;

  const { data, error } = await supabase
    .from("daily_records")
    .select("*")
    .eq("date", date)
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data?.data?.therapists) {
    return { success: false, error: "No daily record found for today yet." };
  }

  const therapists: DailyTherapistBox[] = data.data.therapists;
  const summary = data.data.summary || { laundry: "", note: "" };

  const box = therapists.find((t) => t.id === therapistId);
  if (!box) return { success: false, error: "Therapist not found for today." };

  const timeIn = getCurrentTimeIn();
  const durationMinutes = getMassagePackageDuration(packageCode.toUpperCase());
  const timeOut = durationMinutes
    ? dayjs(timeIn, TIME_FORMAT).add(durationMinutes, "minute").format(TIME_FORMAT)
    : "";

  const newEntry: DailyEntry = {
    timeIn,
    timeOut,
    customerName,
    packageName: packageCode.toUpperCase(),
    rm,
    coupon,
    oil: oil ? String(oil) : "",
    total: Number(rm || 0) + Number(coupon || 0),
    payment,
    laundry: "",
    note: "",
  };

  const updatedTherapists = therapists.map((t) =>
    t.id === therapistId ? { ...t, entries: [...t.entries, newEntry] } : t,
  );

  const { error: upsertError } = await supabase.from("daily_records").upsert(
    {
      date,
      data: { therapists: updatedTherapists, summary },
    },
    { onConflict: "date" },
  );

  if (upsertError) return { success: false, error: upsertError.message };

  return { success: true };
};

/**
 * Adds a new entry (member visit) to the given therapist's row for the
 * given date. Creates the therapist column if the title doesn't exist yet,
 * and creates the day's record entirely if it doesn't exist yet.
 */
export const attachMemberVisitToTherapist = async (params: {
  date: string;
  therapistTitle: string;
  customerName: string;
  packageCode: string;
  rm: number;
  coupon: number;
  oil: number;
  total: number;
}): Promise<{ success: boolean; error?: string }> => {
  const { date, therapistTitle, customerName, packageCode, rm, coupon, oil } =
    params;

  const title = therapistTitle.trim();
  if (!title) return { success: false, error: "Therapist name is required" };

  const { data, error } = await supabase
    .from("daily_records")
    .select("*")
    .eq("date", date)
    .maybeSingle();

  if (error) return { success: false, error: error.message };

  let therapists: DailyTherapistBox[] = data?.data?.therapists || [];
  const summary = data?.data?.summary || { laundry: "", note: "" };

  let box = therapists.find(
    (t) => (t.title || "").trim().toLowerCase() === title.toLowerCase(),
  );

  if (!box) {
    const nextId = therapists.length
      ? Math.max(...therapists.map((t) => t.id)) + 1
      : 1;
    box = { id: nextId, title, entries: [] };
    therapists = [...therapists, box];
  }

  const timeIn = getCurrentTimeIn();
  const durationMinutes = getMassagePackageDuration(packageCode.toUpperCase());
  const timeOut = durationMinutes
    ? dayjs(timeIn, TIME_FORMAT).add(durationMinutes, "minute").format(TIME_FORMAT)
    : "";

  const newEntry: DailyEntry = {
    timeIn,
    timeOut,
    customerName,
    packageName: packageCode.toUpperCase(),
    rm,
    coupon,
    oil: oil ? String(oil) : "",
    total: Number(rm || 0) + Number(coupon || 0),
    payment: "MEMBER",
    laundry: "",
    note: "",
  };

  therapists = therapists.map((t) =>
    t.id === box!.id ? { ...t, entries: [...t.entries, newEntry] } : t,
  );

  const { error: upsertError } = await supabase.from("daily_records").upsert(
    {
      date,
      data: { therapists, summary },
    },
    { onConflict: "date" },
  );

  if (upsertError) return { success: false, error: upsertError.message };

  return { success: true };
};
