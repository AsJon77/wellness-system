import React, { useEffect, useRef, useState } from "react";
import {
  AutoComplete,
  Card,
  Input,
  InputNumber,
  Select,
  Row,
  Col,
  TimePicker,
  Typography,
  Button,
  DatePicker,
  Spin,
  Skeleton,
  Modal,
} from "antd";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { supabase } from "../supabase";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {
  getMassagePackageDuration,
  massagePackageOptions,
} from "../data/massagePackages";

dayjs.extend(utc);
dayjs.extend(timezone);

type Entry = {
  timeIn: string;
  timeOut: string;
  packageName: string;
  rm: number | string;
  coupon: number | string;
  oil: string;
  total: number;
  payment: string;
  laundry: string;
  note: string;
};

type TherapistBox = {
  id: number;
  title: string;
  entries: Entry[];
};

const paymentOptions = ["CASH", "CARD", "TNG", "FREE"];

const TIME_FORMAT = "HH:mm";

const getCurrentTimeIn = () => {
  const now = dayjs();
  const roundedMinutes = Math.floor(now.minute() / 5) * 5;

  return now
    .minute(roundedMinutes)
    .second(0)
    .millisecond(0)
    .format(TIME_FORMAT);
};

const addMinutesToTime = (time: string, durationMinutes: number) => {
  return dayjs(time, TIME_FORMAT)
    .add(durationMinutes, "minute")
    .format(TIME_FORMAT);
};

const createEmptyEntry = (): Entry => ({
  timeIn: "",
  timeOut: "",
  packageName: "",
  rm: "",
  coupon: "",
  oil: "",
  total: 0,
  payment: "",
  laundry: "",
  note: "",
});

const createInitialTherapists = (): TherapistBox[] => {
  return Array.from({ length: 8 }, (_, index) => ({
    id: index + 1,
    title: "",
    entries: Array.from({ length: 0 }, () => createEmptyEntry()),
  }));
};

const getHeaderColor = (title: string) => {
  const upper = title.toUpperCase().trim();

  if (upper.endsWith("M")) {
    return "#dbeafe"; // blue
  }

  if (upper.endsWith("F")) {
    return "#fce7f3"; // pink
  }

  return "#f3f4f6"; // gray
};

const TherapistTable: React.FC = () => {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("user");
  const [roleLoaded, setRoleLoaded] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const loadUserInfo = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setUserEmail(null);
      setUserRole("user");
      setIsAdmin(false);
      setRoleLoaded(true);
      return;
    }

    setUserEmail(user.email || "");

    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Role fetch error:", error);
      setUserRole("user");
      setIsAdmin(false);
    } else {
      const role = String(data?.role || "user")
        .trim()
        .toLowerCase();

      setUserRole(role);
      setIsAdmin(role === "admin");
    }

    setRoleLoaded(true);
  };

  const isSavingRef = useRef(false);
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const skipNextRealtimeRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const remoteUpdateRef = useRef(false);
  const hasLocalChangesRef = useRef(false);

  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    dayjs().format("YYYY-MM-DD"),
  );

  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error" | "retrying"
  >("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const [therapists, setTherapists] = useState<TherapistBox[]>(
    createInitialTherapists(),
  );
  // ✅ FIX: always mirror latest therapists in a ref so updateEntry never uses stale state
  const therapistsRef = useRef<TherapistBox[]>(therapists);
  useEffect(() => {
    therapistsRef.current = therapists;
  }, [therapists]);

  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [serverUpdatedAt, setServerUpdatedAt] = useState<string | null>(null);
  const [isConflict, setIsConflict] = useState(false);

  // ✅ FIX 1: Remove isEditing state entirely — it was blocking saves
  // We now use a pure debounce approach instead

  const markLocalChange = () => {
    hasLocalChangesRef.current = true;
    remoteUpdateRef.current = false;
  };

  const addRow = (therapistId: number) => {
    if (!isAdmin) return;

    markLocalChange();

    setTherapists((prev) =>
      prev.map((t) => {
        if (t.id !== therapistId) return t;
        return {
          ...t,
          entries: [...t.entries, createEmptyEntry()],
        };
      }),
    );
  };

  const [summary, setSummary] = useState({
    laundry: "",
    note: "",
  });

  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // auto reload no click refresh
  const reloadCurrentDate = async () => {
    if (!selectedDate) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("daily_records")
      .select("*")
      .eq("date", selectedDate)
      .maybeSingle();

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    if (!data) {
      setTherapists(createInitialTherapists());
      setSummary({ laundry: "", note: "" });
      setServerUpdatedAt(null);
    } else {
      setTherapists(data.data?.therapists || createInitialTherapists());
      setSummary(data.data?.summary || { laundry: "", note: "" });
      setServerUpdatedAt(data.updated_at);
    }

    hasLocalChangesRef.current = false;
    pendingSaveRef.current = false;
    remoteUpdateRef.current = false;
    setIsConflict(false);
    setLoading(false);
  };

  // check user role on load
  useEffect(() => {
    const init = async () => {
      await loadUserInfo();
    };

    init();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      if (!selectedDate) return;

      setLoading(true);

      const formattedDate = dayjs(selectedDate).format("YYYY-MM-DD");

      const { data, error } = await supabase
        .from("daily_records")
        .select("*")
        .eq("date", formattedDate)
        .maybeSingle();

      if (error) {
        console.error("❌ Load error:", error);
        setLoading(false);
        return;
      }

      if (!data) {
        setTherapists(createInitialTherapists());
        setSummary({ laundry: "", note: "" });
        setServerUpdatedAt(null);
        hasLocalChangesRef.current = false;
        pendingSaveRef.current = false;
        remoteUpdateRef.current = false;
        setLoading(false);
        return;
      }

      setTherapists(data.data?.therapists || createInitialTherapists());
      setSummary(data.data?.summary || { laundry: "", note: "" });
      setServerUpdatedAt(data.updated_at || null);
      setServerVersion(data.updated_at || null);
      hasLocalChangesRef.current = false;
      pendingSaveRef.current = false;
      remoteUpdateRef.current = false;
      setLoading(false);
    };

    loadData();
  }, [selectedDate]);

  // ✅ REALTIME SYNC
  useEffect(() => {
    if (!selectedDate) return;

    const channel = supabase
      .channel(`daily-record-${selectedDate}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "daily_records",
        },
        async (payload) => {
          console.log("Realtime update:", payload);

          const updatedRecord = payload.new as any;

          if (!updatedRecord) return;

          // ✅ only current date
          if (updatedRecord.date !== selectedDate) return;

          // ✅ VERY IMPORTANT
          // skip realtime triggered by our own save
          if (skipNextRealtimeRef.current) {
            skipNextRealtimeRef.current = false;
            return;
          }

          // ✅ NEVER overwrite while typing
          if (isTypingRef.current) return;

          // ✅ safe update
          const newTherapists =
            updatedRecord.data?.therapists || createInitialTherapists();

          const newSummary = updatedRecord.data?.summary || {
            laundry: "",
            note: "",
          };

          remoteUpdateRef.current = true;
          setTherapists(newTherapists);
          setSummary(newSummary);

          setServerVersion(updatedRecord.updated_at || null);
          setServerUpdatedAt(updatedRecord.updated_at || null);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate]);

  useEffect(() => {
    if (!selectedDate || loading) return;
    if (!roleLoaded) return;
    if (!isAdmin) return;

    // ✅ FIX 4: Check ANY meaningful data — title, packageName, entries, summary
    const hasAnyData =
      therapists.some(
        (t) =>
          t.title.trim() !== "" || // ✅ title counts as data
          t.entries.some(
            (e) =>
              e.timeIn ||
              e.timeOut ||
              e.packageName || // ✅ packageName counts as data
              e.rm ||
              e.coupon ||
              e.oil ||
              e.payment ||
              e.note ||
              e.laundry,
          ),
      ) ||
      summary.laundry !== "" ||
      summary.note !== "";

    if (!hasAnyData) return;

    // Save quickly so a selected payment/package is less likely to be lost on refresh.
    const timeout = setTimeout(async () => {
      if (remoteUpdateRef.current) {
        remoteUpdateRef.current = false;
        hasLocalChangesRef.current = false;
        setSaveStatus("idle");
        return;
      }

      if (!hasLocalChangesRef.current) return;

      if (isSavingRef.current) {
        pendingSaveRef.current = true;
        return;
      }

      isSavingRef.current = true;
      hasLocalChangesRef.current = false;
      setSaveStatus("saving");

      try {
        const formattedDate = dayjs(selectedDate).format("YYYY-MM-DD");

        // ✅ clean empty rows before saving
        const cleanTherapists = therapists.map((t) => ({
          ...t,
          entries: t.entries.filter(
            (e) =>
              e.timeIn ||
              e.timeOut ||
              e.packageName ||
              e.rm ||
              e.coupon ||
              e.oil ||
              e.payment ||
              e.note ||
              e.laundry,
          ),
        }));

        // ✅ prevent our OWN realtime save from reloading UI
        skipNextRealtimeRef.current = true;

        // ✅ save to Supabase
        const { error, data } = await supabase
          .from("daily_records")
          .upsert(
            {
              date: formattedDate,
              data: {
                therapists: cleanTherapists,
                summary,
              },
            },
            { onConflict: "date" },
          )
          .select("updated_at")
          .single();

        if (error) {
          console.error("Save failed:", error);
          hasLocalChangesRef.current = true;

          if (retryCountRef.current < 5) {
            retryCountRef.current += 1;
            setSaveStatus("retrying");

            retryTimeoutRef.current = setTimeout(() => {
              isSavingRef.current = false;
              setTherapists((prev) => [...prev]);
            }, 3000);
          } else {
            setSaveStatus("error");
            retryCountRef.current = 0;
          }
          return;
        }

        // ✅ success
        setSaveStatus("saved");
        retryCountRef.current = 0;

        setServerVersion(data.updated_at);
        setServerUpdatedAt(data.updated_at);

        const malaysiaTime = dayjs
          .utc(data.updated_at)
          .tz("Asia/Kuala_Lumpur")
          .format("hh:mm A");

        setLastSavedAt(malaysiaTime);

        setTimeout(() => {
          if (!isSavingRef.current) {
            setSaveStatus("idle");
          }
        }, 2000);
      } catch (err) {
        console.error(err);
        hasLocalChangesRef.current = true;
        setSaveStatus("error");
      } finally {
        isSavingRef.current = false;

        if (pendingSaveRef.current || hasLocalChangesRef.current) {
          pendingSaveRef.current = false;
          setTherapists((prev) => [...prev]);
        }
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [therapists, summary, selectedDate, loading, roleLoaded, isAdmin]);
  // ✅ FIX 6: serverVersion removed from deps — it caused save loops

  const updateTitle = (therapistId: number, value: string) => {
    if (!isAdmin) return;

    markLocalChange();

    // ✅ No triggerEditing needed — just update state, autosave handles it
    setTherapists((prev) =>
      prev.map((item) =>
        item.id === therapistId ? { ...item, title: value } : item,
      ),
    );
  };

  const updateEntry = (
    therapistId: number,
    entryIndex: number,
    field: keyof Entry,
    value: string | number,
  ) => {
    if (!isAdmin) return;

    markLocalChange();

    // ✅ user currently typing
    isTypingRef.current = true;

    // ✅ reset typing timer
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
    }, 2000);

    setTherapists((prev) => {
      return prev.map((therapist) => {
        if (therapist.id !== therapistId) return therapist;

        const newEntries = [...therapist.entries];

        const currentEntry = {
          ...newEntries[entryIndex],
        };

        const updatedEntry: Entry = {
          ...currentEntry,
          [field]: value,
        };

        if (field === "packageName") {
          updatedEntry.packageName = String(value).toUpperCase();

          if (updatedEntry.packageName === "OFF") {
            updatedEntry.timeIn = "";
            updatedEntry.timeOut = "";
          }

          const durationMinutes = getMassagePackageDuration(
            updatedEntry.packageName,
          );

          if (durationMinutes) {
            const timeIn = updatedEntry.timeIn || getCurrentTimeIn();

            updatedEntry.timeIn = timeIn;
            updatedEntry.timeOut = addMinutesToTime(timeIn, durationMinutes);
          }
        }

        if (field === "payment") {
          updatedEntry.payment = value ? String(value).toUpperCase() : "";
        }

        if (field === "timeIn") {
          if (!value) {
            updatedEntry.timeOut = "";
          } else {
            const durationMinutes = getMassagePackageDuration(
              updatedEntry.packageName,
            );

            if (durationMinutes) {
              updatedEntry.timeOut = addMinutesToTime(
                String(value),
                durationMinutes,
              );
            }
          }
        }

        updatedEntry.total =
          Number(updatedEntry.rm || 0) +
          Number(updatedEntry.coupon || 0) +
          (parseFloat(String(updatedEntry.oil)) || 0);

        newEntries[entryIndex] = updatedEntry;

        return {
          ...therapist,
          entries: newEntries,
        };
      });
    });
  };

  const clearAllData = async () => {
    if (!isAdmin) return;

    const confirmed = window.confirm(`Are you sure?\n\nThis cannot be undone.`);

    if (!confirmed) return;

    try {
      const emptyTherapists = createInitialTherapists();

      setTherapists(emptyTherapists);
      setSummary({ laundry: "", note: "" });
      hasLocalChangesRef.current = false;
      pendingSaveRef.current = false;
      remoteUpdateRef.current = false;
      setServerVersion(null);
      setServerUpdatedAt(null);

      const { error } = await supabase
        .from("daily_records")
        .delete()
        .eq("date", selectedDate);

      if (error) {
        console.error("Delete error:", error);
        alert("Failed to clear data.");
        return;
      }

      alert("All data cleared successfully.");
    } catch (err) {
      console.error(err);
      alert("Something went wrong.");
    }
  };

  const safeTherapists = Array.isArray(therapists)
    ? therapists
    : createInitialTherapists();

  const summaryTotals = safeTherapists.reduce(
    (acc, therapist) => {
      therapist.entries.forEach((entry) => {
        const total = Number(entry.total) || 0;
        const payment = (entry.payment || "").toUpperCase();

        if (payment === "CASH") acc.cash += total;
        if (payment === "CARD") acc.card += total;
        if (payment === "TNG") acc.tng += total;

        acc.grand += total;
      });

      return acc;
    },
    { cash: 0, card: 0, tng: 0, grand: 0 },
  );

  const printRef = React.useRef<HTMLDivElement>(null);

  const handleExportPDF = async () => {
    if (!printRef.current) return;

    const canvas = await html2canvas(printRef.current, {
      scale: 2,
      useCORS: true,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");

    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`wellness-${selectedDate}.pdf`);
  };

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={printRef}
      className={`print-area page-container ${
        !isAdmin ? "view-only-mode" : ""
      }`}
      style={{ paddingTop: "10px" }}
    >
      <div
        className="no-print app-toolbar"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 999,
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(10px)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          marginBottom: 18,
          borderBottom: "1px solid #e5e7eb",
          padding: "14px 20px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
          flexWrap: "wrap",
          overflowX: "auto",
        }}
      >
        <div>
          <Typography.Title
            level={2}
            style={{ margin: 0, fontSize: "22px", whiteSpace: "nowrap" }}
          >
            🧘ZENLAND WELLNESS DAILY SYSTEM
          </Typography.Title>
        </div>

        <div
          className="toolbar-actions"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "nowrap",
            whiteSpace: "nowrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <strong>DATE:</strong>
            <DatePicker
              value={selectedDate ? dayjs(selectedDate) : null}
              format="YYYY-MM-DD"
              disabled={false}
              onChange={(date) => {
                if (date) {
                  setSelectedDate(date.format("YYYY-MM-DD"));
                }
              }}
            />
          </div>

          <span
            style={{
              padding: "2px 8px",
              borderRadius: 6,
              background: userRole === "admin" ? "#f6ffed" : "#f5f5f5",
              color: userRole === "admin" ? "#389e0d" : "#555",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {roleLoaded
              ? userRole === "admin"
                ? "ADMIN"
                : "VIEW ONLY"
              : "CHECKING..."}
          </span>

          <Button
            danger
            onClick={handleLogout}
            style={{
              borderRadius: 8,
              height: 36,
              paddingInline: 18,
              fontWeight: 600,
            }}
          >
            Logout
          </Button>

          <Button
            style={{
              borderRadius: 8,
              height: 36,
              paddingInline: 18,
              fontWeight: 600,
            }}
            onClick={handleExportPDF}
            type="primary"
            disabled={!isAdmin}
          >
            Export PDF
          </Button>

          <Button
            style={{
              borderRadius: 8,
              height: 36,
              paddingInline: 18,
              fontWeight: 600,
            }}
            danger
            onClick={clearAllData}
            disabled={!isAdmin}
          >
            Clear All
          </Button>

          <Button
            style={{
              borderRadius: 8,
              height: 36,
              paddingInline: 18,
              fontWeight: 600,
            }}
            onClick={() => navigate("/dashboard")}
            type="default"
            disabled={!roleLoaded}
          >
            📊 Dashboard
          </Button>

          <div style={{ marginLeft: 10 }}>
            {!roleLoaded && (
              <span style={{ color: "#999" }}>Checking role...</span>
            )}
            {roleLoaded && !isAdmin && (
              <span style={{ color: "#999" }}>Read only</span>
            )}
            {roleLoaded && isAdmin && saveStatus === "saving" && (
              <span style={{ color: "#faad14" }}>⏳ Saving...</span>
            )}
            {roleLoaded && isAdmin && saveStatus === "saved" && (
              <span style={{ color: "#52c41a" }}>
                ✅ Saved{lastSavedAt && ` at ${lastSavedAt}`}
              </span>
            )}
            {roleLoaded && isAdmin && saveStatus === "retrying" && (
              <span style={{ color: "#fa8c16" }}>🔄 Retrying...</span>
            )}
            {roleLoaded && isAdmin && saveStatus === "error" && (
              <span style={{ color: "#ff4d4f" }}>❌ Error</span>
            )}
            {roleLoaded && isAdmin && saveStatus === "idle" && (
              <span style={{ color: "#999" }}>
                ✔ Update{lastSavedAt && ` (${lastSavedAt})`}
              </span>
            )}
          </div>
        </div>
      </div>

      {isConflict && (
        <div
          style={{
            background: "#fff3cd",
            border: "1px solid #ffeeba",
            padding: 10,
            marginBottom: 10,
            borderRadius: 6,
          }}
        >
          ⚠️ Data was updated on another device
          <div style={{ marginTop: 8 }}>
            <Button
              size="small"
              type="primary"
              onClick={reloadCurrentDate}
              disabled={!isAdmin}
            >
              🔄 Reload Latest
            </Button>
            <Button
              size="small"
              style={{ marginLeft: 8 }}
              onClick={() => setIsConflict(false)}
              disabled={!isAdmin}
            >
              ✏️ Continue Editing
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <Row gutter={[16, 16]}>
          {Array.from({ length: 8 }).map((_, index) => (
            <Col xs={24} sm={24} md={12} lg={12} xl={12} key={index}>
              <Card style={{ borderRadius: 8, border: "1px solid #eee" }}>
                <Skeleton.Input active block style={{ height: 220 }} />
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <Row gutter={[16, 16]}>
          {Array.isArray(therapists) &&
            therapists.length > 0 &&
            therapists.map((therapist) => {
              const totalRm = therapist.entries.reduce(
                (sum, e) => sum + (Number(e.rm) || 0),
                0,
              );
              const totalCoupon = therapist.entries.reduce(
                (sum, e) => sum + (Number(e.coupon) || 0),
                0,
              );
              const totalOil = therapist.entries.reduce(
                (sum, e) => sum + (Number(e.oil) || 0),
                0,
              );
              const grandTotal = therapist.entries.reduce(
                (sum, e) => sum + (Number(e.total) || 0),
                0,
              );

              return (
                <Col
                  xs={24}
                  sm={24}
                  md={24}
                  lg={12}
                  xl={12}
                  key={therapist.id}
                  className="print-col"
                >
                  <Card
                    className="therapist-card"
                    bodyStyle={{ padding: 0 }}
                    style={{
                      border: "1px solid #999",
                      width: "100%",
                      margin: "0 auto",
                      borderRadius: 4,
                      overflow: "hidden",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                    }}
                  >
                    <Spin spinning={loading}>
                      <div
                        className="therapist-table-wrap"
                        style={{
                          width: "100%",
                          overflowX: "auto",
                          overflowY: "hidden",
                        }}
                      >
                        <table
                          className="therapist-table"
                          style={{
                            width: "100%",
                            minWidth: 0,
                            borderCollapse: "collapse",
                            tableLayout: "fixed",
                            fontSize: "12px",
                          }}
                        >
                          <thead>
                            <tr>
                              <th colSpan={2} style={thStyle}>
                                TIME
                              </th>
                              <th rowSpan={2} style={thStyle}>
                                PACKAGE
                              </th>
                              <th rowSpan={2} style={thStyle}>
                                RM
                              </th>
                              <th rowSpan={2} style={thStyle}>
                                COUPON
                              </th>
                              <th rowSpan={2} style={thStyle}>
                                OIL/HS20 /NETT
                              </th>
                              <th rowSpan={2} style={thStyle}>
                                TOTAL
                              </th>
                              <th
                                style={{
                                  ...paymentTopStyle,
                                  background: getHeaderColor(therapist.title),
                                }}
                              >
                                <Input
                                  value={therapist.title}
                                  disabled={!isAdmin}
                                  onChange={(e) => {
                                    updateTitle(therapist.id, e.target.value);
                                  }}
                                  placeholder={`${therapist.id}`}
                                  bordered={false}
                                  style={{
                                    textAlign: "center",
                                    fontWeight: "bold",
                                    fontSize: "13px",
                                    background: "transparent",
                                  }}
                                />
                              </th>
                            </tr>
                            <tr>
                              <th style={thStyle}>IN</th>
                              <th style={thStyle}>OUT</th>
                              <th style={thStyle}>PAYMENT</th>
                            </tr>
                          </thead>

                          <tbody>
                            {therapist.entries.map((entry, index) => (
                              <tr key={`${therapist.id}-${index}`}>
                                <td style={{ ...tdStyle, minWidth: "95px" }}>
                                  <TimePicker
                                    disabled={!isAdmin}
                                    value={
                                      entry.timeIn
                                        ? dayjs(entry.timeIn, TIME_FORMAT)
                                        : null
                                    }
                                    format={TIME_FORMAT}
                                    minuteStep={5}
                                    use12Hours={false}
                                    onOk={(time) => {
                                      if (!time) return;
                                      updateEntry(
                                        therapist.id,
                                        index,
                                        "timeIn",
                                        time.format(TIME_FORMAT),
                                      );
                                    }}
                                    onChange={(time) => {
                                      // ✅ only fire when user clears the field (time is null)
                                      if (time) return;
                                      updateEntry(
                                        therapist.id,
                                        index,
                                        "timeIn",
                                        "",
                                      );
                                    }}
                                    size="small"
                                    style={{
                                      width: "73px",
                                      display: "block",
                                      margin: "0 auto",
                                    }}
                                  />
                                </td>

                                <td style={{ ...tdStyle, minWidth: "95px" }}>
                                  <TimePicker
                                    disabled={!isAdmin}
                                    value={
                                      entry.timeOut
                                        ? dayjs(entry.timeOut, TIME_FORMAT)
                                        : null
                                    }
                                    format={TIME_FORMAT}
                                    minuteStep={5}
                                    use12Hours={false}
                                    onChange={(time) => {
                                      if (!time) return;
                                      updateEntry(
                                        therapist.id,
                                        index,
                                        "timeOut",
                                        time.format(TIME_FORMAT),
                                      );
                                    }}
                                    size="small"
                                    style={{
                                      width: "73px",
                                      display: "block",
                                      margin: "0 auto",
                                    }}
                                  />
                                </td>

                                <td style={tdStyle}>
                                  <AutoComplete
                                    disabled={!isAdmin}
                                    value={entry.packageName}
                                    onChange={(value) =>
                                      updateEntry(
                                        therapist.id,
                                        index,
                                        "packageName",
                                        value,
                                      )
                                    }
                                    size="small"
                                    placeholder="Select"
                                    allowClear
                                    options={massagePackageOptions}
                                    popupMatchSelectWidth={false}
                                    filterOption={(inputValue, option) =>
                                      String(option?.label ?? "")
                                        .toUpperCase()
                                        .includes(inputValue.toUpperCase()) ||
                                      String(option?.value ?? "")
                                        .toUpperCase()
                                        .includes(inputValue.toUpperCase())
                                    }
                                    style={{
                                      width: "100%",
                                    }}
                                    className="package-select"
                                  />
                                </td>

                                <td style={tdStyle}>
                                  <InputNumber
                                    disabled={!isAdmin}
                                    min={0}
                                    value={entry.rm}
                                    onChange={(value) =>
                                      updateEntry(
                                        therapist.id,
                                        index,
                                        "rm",
                                        value ?? "",
                                      )
                                    }
                                    size="small"
                                    controls={false}
                                    bordered={false}
                                    style={{ width: "50px" }}
                                    className="centered-input-number"
                                  />
                                </td>

                                <td style={tdStyle}>
                                  <InputNumber
                                    disabled={!isAdmin}
                                    min={0}
                                    value={entry.coupon}
                                    onChange={(value) =>
                                      updateEntry(
                                        therapist.id,
                                        index,
                                        "coupon",
                                        value ?? "",
                                      )
                                    }
                                    size="small"
                                    bordered={false}
                                    controls={false}
                                    style={{ width: "50px" }}
                                    className="centered-input-number"
                                  />
                                </td>

                                <td style={tdStyle}>
                                  <Input
                                    disabled={!isAdmin}
                                    value={entry.oil}
                                    onChange={(e) =>
                                      updateEntry(
                                        therapist.id,
                                        index,
                                        "oil",
                                        e.target.value,
                                      )
                                    }
                                    size="small"
                                    bordered={false}
                                    style={{
                                      textAlign: "center",
                                      width: "100%",
                                    }}
                                  />
                                </td>

                                <td style={tdStyle}>
                                  <strong>{entry.total || 0}</strong>
                                </td>

                                <td style={tdStyle}>
                                  {!isAdmin ? (
                                    <div
                                      style={{
                                        width: "72px",
                                        height: "26px",
                                        margin: "0 auto",
                                        borderRadius: "6px",

                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",

                                        fontWeight: 700,
                                        fontSize: "11px",
                                        lineHeight: 1,

                                        color: "#fff",

                                        boxSizing: "border-box",
                                        padding: "0 6px",
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",

                                        backgroundColor:
                                          entry.payment?.toUpperCase() ===
                                          "CASH"
                                            ? "#22c55e"
                                            : entry.payment?.toUpperCase() ===
                                              "CARD"
                                            ? "#4b5563"
                                            : entry.payment?.toUpperCase() ===
                                              "TNG"
                                            ? "#1668dc"
                                            : entry.payment?.toUpperCase() ===
                                              "FREE"
                                            ? "#f97316"
                                            : "#d1d5db",
                                      }}
                                    >
                                      {entry.payment || "-"}
                                    </div>
                                  ) : (
                                    <Select
                                      disabled={!isAdmin}
                                      value={entry.payment || undefined}
                                      onChange={(value) =>
                                        updateEntry(
                                          therapist.id,
                                          index,
                                          "payment",
                                          value ?? "",
                                        )
                                      }
                                      size="small"
                                      placeholder=""
                                      allowClear
                                      style={{
                                        width: "80px",
                                        display: "block",
                                        margin: "0 auto",
                                      }}
                                      popupMatchSelectWidth={false}
                                      dropdownStyle={{ borderRadius: "10px" }}
                                      options={paymentOptions.map((item) => ({
                                        label: item,
                                        value: item,
                                      }))}
                                      className={`payment-select payment-${
                                        entry.payment?.toLowerCase() || "empty"
                                      }`}
                                    />
                                  )}
                                </td>
                              </tr>
                            ))}

                            <tr>
                              <td colSpan={3} style={totalLabelStyle}>
                                TOTAL
                              </td>
                              <td style={totalValueStyle}>{totalRm}</td>
                              <td style={totalValueStyle}>{totalCoupon}</td>
                              <td style={totalValueStyle}>{totalOil}</td>
                              <td style={totalValueStyle}>
                                <strong>{grandTotal}</strong>
                              </td>
                              <td style={totalValueStyle}></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </Spin>
                  </Card>
                  <div
                    className="no-print"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: 0,
                    }}
                  >
                    <Button
                      size="small"
                      type="link"
                      onClick={() => addRow(therapist.id)}
                      disabled={!isAdmin}
                    >
                      + Add Row
                    </Button>
                  </div>
                </Col>
              );
            })}
        </Row>
      )}

      {/* Bottom Summary */}
      <div
        className="summary-print-box"
        style={{
          marginTop: 17,
          border: "1px solid #999",
          padding: "13px",
          borderRadius: 6,
          background: "#fafafa",
        }}
      >
        <div
          style={{ marginBottom: 16, display: "flex", alignItems: "center" }}
        >
          <Typography.Title
            level={5}
            style={{ marginTop: 0, marginBottom: 16 }}
          >
            DAILY SUMMARY
          </Typography.Title>

          <div
            style={{
              display: "flex",
              gap: 50,
              marginBottom: -15,
              marginLeft: 120,
              flexWrap: "wrap",
              alignItems: "center",
              color: "#555",
            }}
          >
            <div style={{ display: "flex", alignItems: "center" }}>
              <div>laundry:</div>
              <Input
                disabled={!isAdmin}
                value={summary.laundry}
                onChange={(e) => {
                  if (!isAdmin) return;
                  markLocalChange();
                  setSummary((prev) => ({ ...prev, laundry: e.target.value }));
                }}
                size="small"
                style={{
                  width: 57,
                  marginLeft: 3,
                  color: "#555",
                  textAlign: "center",
                }}
                placeholder="Input..."
              />
            </div>

            <div style={{ display: "flex", alignItems: "center" }}>
              <div>NOTE:</div>
              <Input
                disabled={!isAdmin}
                value={summary.note}
                onChange={(e) => {
                  if (!isAdmin) return;
                  markLocalChange();
                  setSummary((prev) => ({ ...prev, note: e.target.value }));
                }}
                size="small"
                style={{
                  width: "210px",
                  marginLeft: 6,
                  textAlign: "center",
                  color: "#555",
                }}
                placeholder="Additional notes"
              />
            </div>
          </div>
        </div>

        <Row gutter={[16, 16]}>
          <Col xs={12} sm={12} md={6}>
            <div style={summaryBoxStyle}>
              <div style={summaryLabelStyle}>CASH</div>
              <div style={summaryValueStyle}>{summaryTotals.cash + " RM"}</div>
            </div>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <div style={summaryBoxStyle}>
              <div style={summaryLabelStyle}>TNG</div>
              <div style={summaryValueStyle}>{summaryTotals.tng + " RM"}</div>
            </div>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <div style={summaryBoxStyle}>
              <div style={summaryLabelStyle}>CARD</div>
              <div style={summaryValueStyle}>{summaryTotals.card + " RM"}</div>
            </div>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <div style={summaryBoxStyle}>
              <div style={{ fontSize: "12px", fontWeight: 600 }}>
                GRAND TOTAL
              </div>
              <div style={{ fontSize: "20px", fontWeight: 700 }}>
                {summaryTotals.grand + " RM"}
              </div>
            </div>
          </Col>
        </Row>
      </div>
    </div>
  );
};

const thStyle: React.CSSProperties = {
  border: "1px solid #999",
  padding: "6px",
  textAlign: "center",
  background: "#f5f5f5",
  fontWeight: "bold",
};

const paymentTopStyle: React.CSSProperties = {
  border: "1px solid #999",
  padding: "0",
  textAlign: "center",
  background: "#f8d7da",
  fontWeight: "bold",
  minWidth: "100px",
};

const tdStyle: React.CSSProperties = {
  border: "1px solid #999",
  padding: "2px",
  textAlign: "center",
  verticalAlign: "middle",
};

const totalLabelStyle: React.CSSProperties = {
  border: "1px solid #999",
  padding: "6px",
  textAlign: "center",
  fontWeight: "bold",
  background: "#fafafa",
};

const totalValueStyle: React.CSSProperties = {
  border: "1px solid #999",
  padding: "6px",
  textAlign: "center",
  background: "#fafafa",
};

const summaryBoxStyle: React.CSSProperties = {
  border: "1px solid #999",
  borderRadius: 4,
  background: "#fff",
  padding: "6px",
  textAlign: "center",
};

const summaryLabelStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "#666",
  marginBottom: "2px",
};

const summaryValueStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 600,
  color: "#111",
};

export default TherapistTable;
