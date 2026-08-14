import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {
  LeftOutlined,
  RightOutlined,
  CreditCardOutlined,
  WalletOutlined,
  MobileOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  UserOutlined,
  TeamOutlined,
  PrinterOutlined,
} from "@ant-design/icons";
import { fetchDailyRecordForDate, todayMYT, DailyTherapistBox } from "../data/dailyRecordsApi";

dayjs.extend(utc);
dayjs.extend(timezone);

const MYT = "Asia/Kuala_Lumpur";
const PRIMARY = "#2F4F44";
const PRIMARY_SOFT = "#E7EEE9";
const ACCENT = "#C68A3E";
const BLUE = "#3E5A8C";
const BLUE_SOFT = "#E9EEF7";
const LINE = "#E4E9E5";
const BG = "#F5F7F5";

const History: React.FC = () => {
  const navigate = useNavigate();
  const [date, setDate] = useState(todayMYT());
  const [therapists, setTherapists] = useState<DailyTherapistBox[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchDailyRecordForDate(date).then((list) => {
      setTherapists(list);
      setLoading(false);
    });
  }, [date]);

  const shiftDate = (days: number) => {
    setDate((prev) => dayjs.tz(prev, MYT).add(days, "day").format("YYYY-MM-DD"));
  };

  // Same math as the Daily Summary at the bottom of the Daily System table:
  // only CASH/CARD/TNG count toward Collection (FREE/MEMBER don't).
  const { cash, card, tng, grand, orderCount, customerCount, staffCount } = useMemo(() => {
    let cash = 0, card = 0, tng = 0, grand = 0;
    let orderCount = 0;
    const customers = new Set<string>();
    let staffCount = 0;

    therapists.forEach((t) => {
      let staffHasOrder = false;

      t.entries.forEach((entry) => {
        // Only count rows that actually have a package selected — skip
        // blank template rows added but never filled in.
        if (!entry.packageName) return;

        const total = Number(entry.total) || 0;
        const payment = (entry.payment || "").toUpperCase();

        if (payment === "CASH") cash += total;
        if (payment === "CARD") card += total;
        if (payment === "TNG") tng += total;
        if (["CASH", "CARD", "TNG"].includes(payment)) grand += total;

        orderCount += 1;
        staffHasOrder = true;
        if (entry.customerName) customers.add(entry.customerName);
      });

      if ((t.title || "").trim() && staffHasOrder) staffCount += 1;
    });

    return {
      cash,
      card,
      tng,
      grand,
      orderCount,
      customerCount: customers.size,
      staffCount,
    };
  }, [therapists]);

  const isToday = date === todayMYT();

  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 480, padding: "20px 18px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div
            onClick={() => navigate("/")}
            style={{
              width: 34, height: 34, borderRadius: 10, background: "#fff",
              border: `1px solid ${LINE}`, display: "flex", alignItems: "center",
              justifyContent: "center", cursor: "pointer", color: PRIMARY,
            }}
          >
            <LeftOutlined />
          </div>

          <div
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: "7px 10px",
            }}
          >
            <div onClick={() => shiftDate(-1)} style={{ cursor: "pointer", color: PRIMARY, fontSize: 12 }}>
              <LeftOutlined />
            </div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              {dayjs.tz(date, MYT).format("DD/MM/YYYY")}
            </div>
            <div
              onClick={() => !isToday && shiftDate(1)}
              style={{ cursor: isToday ? "default" : "pointer", color: isToday ? "#C4C9C6" : PRIMARY, fontSize: 12 }}
            >
              <RightOutlined />
            </div>
          </div>

          <div
            onClick={() => window.print()}
            style={{
              width: 34, height: 34, borderRadius: 10, background: "#fff",
              border: `1px solid ${LINE}`, display: "flex", alignItems: "center",
              justifyContent: "center", cursor: "pointer", color: PRIMARY,
            }}
          >
            <PrinterOutlined />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#5C6B63" }}>Loading…</div>
        ) : (
          <>
            <SectionLabel>Collection</SectionLabel>
            <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, marginBottom: 16, overflow: "hidden" }}>
              <Row icon={<ShoppingCartOutlined />} iconBg={PRIMARY_SOFT} iconColor={PRIMARY} label="Grand Total" value={`RM ${grand.toFixed(2)}`} bold />
              <Row icon={<CreditCardOutlined />} iconBg={BLUE_SOFT} iconColor={BLUE} label="Credit card" value={`RM ${card.toFixed(2)}`} />
              <Row icon={<WalletOutlined />} iconBg={PRIMARY_SOFT} iconColor={PRIMARY} label="Cash" value={`RM ${cash.toFixed(2)}`} />
              <Row icon={<MobileOutlined />} iconBg={ACCENT + "22"} iconColor={ACCENT} label="TNG" value={`RM ${tng.toFixed(2)}`} last />
            </div>

            <SectionLabel>Work</SectionLabel>
            <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, overflow: "hidden" }}>
              <Row icon={<ShoppingOutlined />} iconBg={BLUE_SOFT} iconColor={BLUE} label="Order" value={String(orderCount)} />
              <Row icon={<UserOutlined />} iconBg={PRIMARY_SOFT} iconColor={PRIMARY} label="Customer" value={String(customerCount)} />
              <Row icon={<TeamOutlined />} iconBg={ACCENT + "22"} iconColor={ACCENT} label="Staff" value={String(staffCount)} last />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ padding: "6px 2px 8px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#5C6B63" }}>
    {children}
  </div>
);

const Row: React.FC<{
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  bold?: boolean;
  last?: boolean;
}> = ({ icon, iconBg, iconColor, label, value, bold, last }) => (
  <div
    style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "13px 16px", borderBottom: last ? "none" : `1px solid ${LINE}`,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: iconBg, color: iconColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
        {icon}
      </div>
      <div style={{ fontSize: 14, fontWeight: bold ? 700 : 600 }}>{label}</div>
    </div>
    <div style={{ fontSize: bold ? 15 : 14, fontWeight: 700, color: bold ? PRIMARY : "#1E2622" }}>{value}</div>
  </div>
);

export default History;
