import React, { useEffect, useMemo, useState } from "react";
import { Card, Row, Col, DatePicker, InputNumber, Modal, Button } from "antd";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

const { RangePicker } = DatePicker;
const Dashboard: React.FC = () => {
  // ✅ STATE
  const [records, setRecords] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<
    [dayjs.Dayjs | null, dayjs.Dayjs | null] | null
  >(null);
  const [commission, setCommission] = useState(50);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTherapist, setSelectedTherapist] = useState<string | null>(
    null,
  );
  const navigate = useNavigate();

  // ✅ FETCH DATA
  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase.from("daily_records").select("*");

      if (error) {
        console.error(error);
        return;
      }

      setRecords(data || []);
    };

    fetchData();
  }, []);

  // ✅ FILTER BY Date Range
  const filteredRecords = records.filter((record) => {
    if (!dateRange || !dateRange[0] || !dateRange[1]) return true;

    const recordDate = dayjs(record.date);
    const [start, end] = dateRange;

    return (
      recordDate.isSame(start, "day") ||
      recordDate.isSame(end, "day") ||
      (recordDate.isAfter(start) && recordDate.isBefore(end))
    );
  });

  // ✅ Monthly Total (RM )
  const monthlyRM = filteredRecords.reduce((sum, record) => {
    const therapists = record.data?.therapists || [];

    return (
      sum +
      therapists.reduce(
        (tSum: number, t: any) =>
          tSum +
          t.entries.reduce((s: number, e: any) => s + (Number(e.rm) || 0), 0),
        0,
      )
    );
  }, 0);

  // ✅ Monthly Coupon Total
  const monthlyCoupon = filteredRecords.reduce((sum, record) => {
    const therapists = record.data?.therapists || [];

    return (
      sum +
      therapists.reduce(
        (tSum: number, t: any) =>
          tSum +
          t.entries.reduce(
            (s: number, e: any) => s + (Number(e.coupon) || 0),
            0,
          ),
        0,
      )
    );
  }, 0);

  // total payments summary
  const paymentSummary = {
    cash: 0,
    card: 0,
    tng: 0,
  };

  filteredRecords.forEach((record) => {
    const therapists = record.data?.therapists || [];

    therapists.forEach((t: any) => {
      t.entries.forEach((e: any) => {
        const amount = Number(e.total) || 0;

        const payment = (e.payment || "").toLowerCase();

        if (payment === "cash") paymentSummary.cash += amount;
        if (payment === "card") paymentSummary.card += amount;
        if (payment === "tng") paymentSummary.tng += amount;
      });
    });
  });

  const companyTotal =
    paymentSummary.cash + paymentSummary.card + paymentSummary.tng;

  // ✅ Build therapist map (clean)
  const therapistMap = useMemo(() => {
    const map: Record<string, { rm: number; total: number }> = {};

    filteredRecords.forEach((record) => {
      const therapists = record.data?.therapists || [];

      therapists.forEach((t: any) => {
        if (!t.title) return;

        if (!map[t.title]) {
          map[t.title] = { rm: 0, total: 0 };
        }

        t.entries.forEach((e: any) => {
          map[t.title].rm += Number(e.rm) || 0;
          map[t.title].total += Number(e.total) || 0;
        });
      });
    });

    return map;
  }, [filteredRecords]);

  // ✅ Check if any data
  const hasData = Object.values(therapistMap).some(
    (v) => v.rm > 0 || v.total > 0,
  );

  const sortedTherapists = useMemo(
    () =>
      Object.entries(therapistMap)
        .filter(([_, v]) => v.rm > 0 && v.total > 0)
        .sort(([nameA, valuesA], [nameB, valuesB]) => {
          const salaryA = valuesA.rm * (commission / 100);
          const salaryB = valuesB.rm * (commission / 100);

          if (salaryB !== salaryA) return salaryB - salaryA;

          return nameA.localeCompare(nameB);
        }),
    [commission, therapistMap],
  );

  const selectedTherapistBreakdown = useMemo(() => {
    if (!selectedTherapist) return [];

    return filteredRecords
      .map((record) => {
        const therapist = record.data?.therapists?.find(
          (t: any) => t.title === selectedTherapist,
        );

        if (!therapist) return null;

        const total = therapist.entries.reduce(
          (sum: number, e: any) => sum + (Number(e.rm) || 0),
          0,
        );

        return {
          date: record.date,
          total,
        };
      })
      .filter(
        (item): item is { date: string; total: number } =>
          item !== null && item.total > 0,
      )
      .sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf());
  }, [filteredRecords, selectedTherapist]);

  // 📈 TODAY vs YESTERDAY
  const today = dayjs().format("YYYY-MM-DD");
  const yesterday = dayjs().subtract(1, "day").format("YYYY-MM-DD");

  const getDayTotal = (date: string) => {
    const record = records.find((r) => r.date === date);
    if (!record) return 0;

    const therapists = record.data?.therapists || [];

    return therapists.reduce(
      (sum: number, t: any) =>
        sum +
        t.entries.reduce((s: number, e: any) => s + (Number(e.total) || 0), 0),
      0,
    );
  };
  const todayTotal = getDayTotal(today);
  const yesterdayTotal = getDayTotal(yesterday);
  // % change
  const trendPercent =
    yesterdayTotal === 0
      ? 0
      : ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100;

  return (
    <div style={{ padding: 20 }}>
      <Button
        onClick={() => navigate("/")}
        size="small"
        style={{
          marginBottom: 10,
          position: "fixed",
          top: 5,
          left: 10,
          zIndex: 1000,
        }}
      >
        ⬅ Back
      </Button>

      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 15,
          flexWrap: "wrap",
        }}
      >
        {/* LEFT: TITLE */}
        <div>
          <h1
            style={{
              margin: 0,
              marginLeft: 25,
              marginBottom: 0,
            }}
          >
            📊 Dashboard
          </h1>
        </div>
        <div style={{ marginBottom: 15 }}>
          <h3>📈 Daily Trend</h3>

          <div style={{ display: "flex", gap: 20 }}>
            <div>Yesterday: {yesterdayTotal} RM</div>
            <div>Today: {todayTotal} RM</div>

            <div
              style={{
                color: trendPercent >= 0 ? "green" : "red",
                fontWeight: "bold",
              }}
            >
              {trendPercent >= 0 ? "▲" : "▼"} {trendPercent.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* RIGHT: COMPANY SUMMARY */}
        <div style={{ textAlign: "right", minWidth: 220 }}>
          <h4 style={{ marginBottom: 0 }}>🏢 Company Summary</h4>

          <div style={{ color: "green" }}>
            💵 Cash: <strong>{paymentSummary.cash}</strong> RM
          </div>

          <div>
            💳 Card: <strong>{paymentSummary.card}</strong> RM
          </div>

          <div style={{ color: "#1677ff" }}>
            📱 TNG: <strong>{paymentSummary.tng}</strong> RM
          </div>

          <hr style={{ margin: "6px 0" }} />

          <strong>Total: {companyTotal} RM</strong>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 15,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        {/* (filters + commission) */}
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>📅 Select Date Range</div>

          <RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates ?? null)}
            format="YYYY-MM-DD"
          />

          <Button
            onClick={() => setDateRange([dayjs().startOf("month"), dayjs()])}
          >
            This Month
          </Button>

          <Button
            onClick={() => setDateRange([dayjs().subtract(6, "day"), dayjs()])}
          >
            Last 7 Days
          </Button>

          <Button onClick={() => setDateRange(null)}>Reset</Button>

          <div>💰 Commission %</div>
          <InputNumber
            value={commission}
            onChange={(v) => setCommission(v || 0)}
          />
        </div>
      </div>

      {/* MONTHLY RM and Coupon */}
      <div style={{ display: "flex", gap: 30, alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>💰 RM: {monthlyRM} RM</h3>

        <h3 style={{ margin: 0 }}>🎟 Coupon: {monthlyCoupon} RM</h3>
      </div>

      {/* ✅ 8 MINI CARDS */}
      {!hasData ? (
        <div style={{ textAlign: "center", marginTop: 40 }}>
          <h3>No data available</h3>
          <p>Please add therapist income data</p>
        </div>
      ) : (
        <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
          {sortedTherapists.map(([name, values]) => {
            const salary = values.rm * (commission / 100);

            return (
              <Col xs={24} sm={12} md={12} lg={8} xl={6} key={name}>
                <Card
                  onClick={() => {
                    setSelectedTherapist(name);
                    setIsModalOpen(true);
                  }}
                  style={{ textAlign: "center", cursor: "pointer" }}
                >
                  <h3>{name}</h3>

                  {/* RM */}
                  <div>💼 RM</div>
                  <div style={{ fontSize: 18, fontWeight: "bold" }}>
                    {values.rm} RM
                  </div>

                  {/* TOTAL */}
                  <div style={{ marginTop: 6, fontSize: 13, opacity: 0.7 }}>
                    🏢 Total: {values.total} RM
                  </div>

                  {/* SALARY */}
                  <div style={{ marginTop: 10 }}>Salary ({commission}%)</div>
                  <div style={{ color: "green", fontWeight: "bold" }}>
                    {salary.toFixed(2)} RM
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      <Modal
        title={`📅 ${selectedTherapist} Daily Breakdown`}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={500}
      >
        <table style={{ width: "100%", marginTop: 10 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Date</th>
              <th style={{ textAlign: "right" }}>RM</th>
            </tr>
          </thead>

          <tbody>
            {selectedTherapistBreakdown.map((item) => {
              return (
                <tr key={item.date}>
                  <td>{item.date}</td>
                  <td style={{ textAlign: "right" }}>{item.total} RM</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>
                <strong>Total</strong>
              </td>
              <td style={{ textAlign: "right" }}>
                <strong>
                  {selectedTherapistBreakdown.reduce(
                    (sum, item) => sum + item.total,
                    0,
                  )}{" "}
                  RM
                </strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </Modal>
    </div>
  );
};

export default Dashboard;
