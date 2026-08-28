import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { Modal, Form, Input, InputNumber, Select, AutoComplete, message } from "antd";
import { LeftOutlined, PlusOutlined } from "@ant-design/icons";
import {
  fetchDailyRecordForDate,
  todayMYT,
  attachOrderToTherapist,
  addTherapistToDate,
  DailyTherapistBox,
} from "../data/dailyRecordsApi";
import {
  fetchCustomers,
  updateCustomerSessionsUsed,
  updateCustomerCredit,
  logMemberVisit,
} from "../data/customersApi";
import { Customer } from "../data/customers";
import { massagePackageSelectionGroups } from "../data/massagePackages";

dayjs.extend(utc);
dayjs.extend(timezone);

const MYT = "Asia/Kuala_Lumpur";
const TIME_FORMAT = "HH:mm";

const PRIMARY = "#2F4F44";
const PRIMARY_SOFT = "#E7EEE9";
const LINE = "#E4E9E5";
const BG = "#F5F7F5";
const MALE_BG = "#dbeafe"; // same as the Daily System table's header color
const MALE_TEXT = "#1e40af";
const FEMALE_BG = "#fce7f3";
const FEMALE_TEXT = "#9d174d";
const NEUTRAL_BG = "#f3f4f6";
const NEUTRAL_TEXT = "#4b5563";

const genderOf = (title: string): "M" | "F" | "?" => {
  const upper = title.toUpperCase().trim();
  if (upper.endsWith("F")) return "F";
  if (upper.endsWith("M")) return "M";
  return "?";
};

const ORDER_KEY_PREFIX = "zenland-orders-manual-order-";

const Orders: React.FC = () => {
  const navigate = useNavigate();
  const [therapists, setTherapists] = useState<DailyTherapistBox[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DailyTherapistBox | null>(null);
  const [tick, setTick] = useState(0);
  const [addTherapistOpen, setAddTherapistOpen] = useState(false);
  const [newTherapistName, setNewTherapistName] = useState("");
  const [addingTherapist, setAddingTherapist] = useState(false);
  const date = todayMYT();

  // Manual drag-to-reorder, kept purely on this page (in the browser only)
  // and never written back to the Daily System table.
  const [manualOrder, setManualOrder] = useState<number[]>(() => {
    try {
      const raw = localStorage.getItem(ORDER_KEY_PREFIX + date);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const badgeRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const dragState = useRef<{
    id: number | null;
    holdTimer: ReturnType<typeof setTimeout> | null;
    startX: number;
    startY: number;
    dragging: boolean;
  }>({ id: null, holdTimer: null, startX: 0, startY: 0, dragging: false });

  const saveManualOrder = (order: number[]) => {
    setManualOrder(order);
    try {
      localStorage.setItem(ORDER_KEY_PREFIX + date, JSON.stringify(order));
    } catch {
      // ignore storage errors (e.g. private browsing)
    }
  };

  const load = () => {
    setLoading(true);
    Promise.all([fetchDailyRecordForDate(date), fetchCustomers()]).then(
      ([t, c]) => {
        setTherapists(t);
        setCustomers(c);
        setLoading(false);
      },
    );
  };

  useEffect(() => {
    load();
    // Re-check busy/available status every 30s so a therapist automatically
    // rotates back to Available once their current session's time-out passes.
    const interval = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddTherapist = async () => {
    if (!newTherapistName.trim()) return;
    setAddingTherapist(true);
    const result = await addTherapistToDate(date, newTherapistName);
    setAddingTherapist(false);

    if (!result.success) {
      message.error(result.error || "Couldn't add therapist");
      return;
    }

    message.success(`${newTherapistName.trim().toUpperCase()} added`);
    setNewTherapistName("");
    setAddTherapistOpen(false);
    load();
  };

  // A therapist is "off" for the day if they've been marked OFF or MC on any
  // entry today — they're pulled out of the rotation entirely. Otherwise
  // they're "busy" if their latest booked session's time-out hasn't passed
  // yet. Available therapists are ordered so whoever has been idle longest
  // (or never worked today) comes first, and whoever just finished a
  // session rotates to the back of the line — unless a manual order has
  // been set by dragging, which always takes priority.
  const { availableList, busyList, offList } = useMemo(() => {
    const nowStr = dayjs().tz(MYT).format(TIME_FORMAT);

    const statuses = therapists
      .filter((t) => t.title?.trim())
      .map((t) => {
        const isOff = t.entries.some(
          (e) => e.packageName === "OFF" || e.packageName === "MC",
        );
        const timeOuts = t.entries.map((e) => e.timeOut).filter(Boolean) as string[];
        const latest = timeOuts.sort().slice(-1)[0] || null;
        const busy = !isOff && !!latest && latest > nowStr;
        return { ...t, latest, busy, isOff };
      });

    const offList = statuses.filter((t) => t.isOff);

    const rotationOrdered = statuses
      .filter((t) => !t.isOff && !t.busy)
      .sort((a, b) => (a.latest || "").localeCompare(b.latest || ""));

    // Apply the manual drag order on top of the rotation order, when set.
    const availableList = manualOrder.length
      ? [...rotationOrdered].sort((a, b) => {
          const ia = manualOrder.indexOf(a.id);
          const ib = manualOrder.indexOf(b.id);
          return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
        })
      : rotationOrdered;

    const busyList = statuses
      .filter((t) => !t.isOff && t.busy)
      .sort((a, b) => (a.latest || "").localeCompare(b.latest || ""));

    return { availableList, busyList, offList };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [therapists, tick, manualOrder]);

  const male = availableList.filter((t) => genderOf(t.title) === "M");
  const female = availableList.filter((t) => genderOf(t.title) === "F");
  const other = availableList.filter((t) => genderOf(t.title) === "?");

  // Reorders `group` (an array of ids, in current visual order) by moving
  // `draggedId` to sit where `overId` currently is, then folds that back
  // into the full manual-order list so other groups are unaffected.
  const reorderWithinGroup = (group: DailyTherapistBox[], draggedId: number, overId: number) => {
    if (draggedId === overId) return;
    const ids = group.map((t) => t.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(overId);
    if (from === -1 || to === -1) return;

    const reorderedGroup = [...ids];
    reorderedGroup.splice(from, 1);
    reorderedGroup.splice(to, 0, draggedId);

    // Merge: keep every other currently-available id's relative order,
    // just splice this group's new order back into the full sequence.
    const fullOrder = availableList.map((t) => t.id);
    const groupSet = new Set(ids);
    let cursor = 0;
    const merged = fullOrder.map((id) => (groupSet.has(id) ? reorderedGroup[cursor++] : id));

    saveManualOrder(merged);
  };

  const handlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    t: DailyTherapistBox,
  ) => {
    dragState.current.startX = e.clientX;
    dragState.current.startY = e.clientY;
    dragState.current.dragging = false;
    dragState.current.id = t.id;

    dragState.current.holdTimer = setTimeout(() => {
      dragState.current.dragging = true;
      setDraggingId(t.id);
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    }, 450);
  };

  const handlePointerMove = (
    e: React.PointerEvent<HTMLDivElement>,
    group: DailyTherapistBox[],
  ) => {
    const dx = Math.abs(e.clientX - dragState.current.startX);
    const dy = Math.abs(e.clientY - dragState.current.startY);

    // Movement before the hold-timer fires cancels the drag (treat as a
    // scroll/tap instead of a reorder gesture).
    if (!dragState.current.dragging) {
      if (dx > 8 || dy > 8) {
        if (dragState.current.holdTimer) clearTimeout(dragState.current.holdTimer);
        dragState.current.id = null;
      }
      return;
    }

    const draggedId = dragState.current.id;
    if (draggedId == null) return;

    for (const t of group) {
      if (t.id === draggedId) continue;
      const el = badgeRefs.current[t.id];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        reorderWithinGroup(group, draggedId, t.id);
        break;
      }
    }
  };

  const handlePointerUp = () => {
    if (dragState.current.holdTimer) clearTimeout(dragState.current.holdTimer);
    dragState.current.dragging = false;
    dragState.current.id = null;
    setDraggingId(null);
  };

  const Badge: React.FC<{ t: DailyTherapistBox; group: DailyTherapistBox[] }> = ({ t, group }) => {
    const g = genderOf(t.title);
    const bg = g === "M" ? MALE_BG : g === "F" ? FEMALE_BG : NEUTRAL_BG;
    const color = g === "M" ? MALE_TEXT : g === "F" ? FEMALE_TEXT : NEUTRAL_TEXT;
    const isDragging = draggingId === t.id;

    return (
      <div
        ref={(el) => {
          badgeRefs.current[t.id] = el;
        }}
        onPointerDown={(e) => handlePointerDown(e, t)}
        onPointerMove={(e) => handlePointerMove(e, group)}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={() => {
          // A completed drag shouldn't also trigger opening the order form.
          if (dragState.current.dragging) return;
          setSelected(t);
        }}
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: bg,
          color,
          border: `2px solid ${color}55`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          touchAction: "none",
          userSelect: "none",
          transform: isDragging ? "scale(1.12)" : "scale(1)",
          boxShadow: isDragging ? "0 6px 16px rgba(0,0,0,0.25)" : "none",
          opacity: isDragging ? 0.9 : 1,
          zIndex: isDragging ? 5 : 1,
          position: "relative",
          transition: isDragging ? "none" : "transform 0.15s ease",
        }}
        title="Tap to add an order · Press and hold to reorder"
      >
        {t.title}
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 900, padding: "20px 18px 60px" }}>
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
          <div style={{ fontSize: 17, fontWeight: 700 }}>Orders</div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#5C6B63" }}>Loading…</div>
        ) : therapists.filter((t) => t.title?.trim()).length === 0 ? (
          <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 24, textAlign: "center", color: "#5C6B63" }}>
            <div style={{ marginBottom: 14 }}>No therapists set up for today yet.</div>
            <button
              onClick={() => setAddTherapistOpen(true)}
              style={{
                border: `1px solid ${PRIMARY}`, color: PRIMARY, background: "#fff",
                borderRadius: 8, padding: "8px 18px", fontWeight: 600, cursor: "pointer",
              }}
            >
              + Add Therapist
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {/* LEFT: AVAILABLE */}
            <div style={{ flex: "1 1 320px", minWidth: 280 }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#5C6B63", marginBottom: 4 }}>
                Available
              </div>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 12 }}>
                Tap to add an order · Press and hold to reorder the turn
              </div>
              <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 18 }}>
                {availableList.length === 0 ? (
                  <div style={{ padding: "10px 0", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
                    Everyone is currently busy
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: male.length && female.length ? 18 : 0 }}>
                      {male.map((t) => (
                        <Badge key={t.id} t={t} group={male} />
                      ))}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                      {female.map((t) => (
                        <Badge key={t.id} t={t} group={female} />
                      ))}
                    </div>
                    {other.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 18 }}>
                        {other.map((t) => (
                          <Badge key={t.id} t={t} group={other} />
                        ))}
                      </div>
                    )}
                  </>
                )}

                <div style={{ borderTop: `1px solid ${LINE}`, marginTop: 18, paddingTop: 18, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  <div
                    onClick={() => setAddTherapistOpen(true)}
                    style={{
                      width: 56, height: 56, borderRadius: "50%",
                      border: `2px dashed #C4C9C6`, color: "#9CA3AF",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 18, cursor: "pointer", flexShrink: 0,
                    }}
                    title="Add Therapist"
                  >
                    <PlusOutlined />
                  </div>

                  {offList.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {offList.map((t) => (
                        <div
                          key={t.id}
                          title={t.entries.find((e) => e.packageName === "OFF" || e.packageName === "MC")?.packageName}
                          style={{
                            display: "flex", alignItems: "center", gap: 6,
                            background: "#F3F4F6", color: "#6B7280",
                            border: "1px solid #E4E9E5", borderRadius: 20,
                            padding: "6px 12px", fontSize: 12, fontWeight: 600,
                          }}
                        >
                          {t.title}
                          <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.7 }}>
                            {t.entries.find((e) => e.packageName === "OFF" || e.packageName === "MC")?.packageName}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT: WORK UNTIL */}
            <div style={{ flex: "1 1 280px", minWidth: 260 }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#5C6B63", marginBottom: 12 }}>
                Work Until
              </div>
              <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, overflow: "hidden" }}>
                {busyList.length === 0 ? (
                  <div style={{ padding: "20px 16px", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
                    Everyone is available
                  </div>
                ) : (
                  busyList.map((w, i) => (
                    <div
                      key={w.id}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "12px 16px", borderBottom: i === busyList.length - 1 ? "none" : `1px solid ${LINE}`,
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{w.title}</div>
                      <div style={{ fontSize: 13, color: PRIMARY, fontWeight: 700 }}>
                        {w.latest}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <OrderFormModal
        therapist={selected}
        customers={customers}
        date={date}
        onClose={() => setSelected(null)}
        onSaved={load}
      />

      <Modal
        title="Add Therapist"
        open={addTherapistOpen}
        onCancel={() => {
          setAddTherapistOpen(false);
          setNewTherapistName("");
        }}
        onOk={handleAddTherapist}
        okText="Add"
        confirmLoading={addingTherapist}
      >
        <Input
          value={newTherapistName}
          onChange={(e) => setNewTherapistName(e.target.value)}
          onPressEnter={handleAddTherapist}
          placeholder="e.g. 19M or 8F"
          autoFocus
        />
      </Modal>
    </div>
  );
};

const paymentOptions = [
  { value: "CASH", label: "CASH" },
  { value: "CARD", label: "CARD" },
  { value: "TNG", label: "TNG" },
  { value: "FREE", label: "FREE" },
  { value: "MEMBER", label: "MB (Member)" },
];

const OrderFormModal: React.FC<{
  therapist: DailyTherapistBox | null;
  customers: Customer[];
  date: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ therapist, customers, date, onClose, onSaved }) => {
  const [form] = Form.useForm();
  const [computedTotal, setComputedTotal] = useState(0);
  const [saving, setSaving] = useState(false);
  const [packageModalOpen, setPackageModalOpen] = useState(false);
  const [customPackageName, setCustomPackageName] = useState("");

  useEffect(() => {
    if (therapist) {
      form.resetFields();
      setComputedTotal(0);
    }
  }, [therapist, form]);

  const recomputeTotal = () => {
    const values = form.getFieldsValue();
    setComputedTotal(
      Number(values.rm || 0) + Number(values.coupon || 0) + (Number(values.oil) || 0),
    );
  };

  const applyPackageChoice = (choice: { code: string; rm: number; coupon: number }) => {
    form.setFieldsValue({ packageCode: choice.code, rm: choice.rm, coupon: choice.coupon });
    setPackageModalOpen(false);
    recomputeTotal();
  };

  const applyCustomPackage = () => {
    if (!customPackageName.trim()) return;
    form.setFieldsValue({ packageCode: customPackageName.trim().toUpperCase() });
    setCustomPackageName("");
    setPackageModalOpen(false);
    recomputeTotal();
  };

  const customerOptions = customers.map((c) => ({ value: c.name }));

  // Reactively re-evaluated on every render (which happens on every field
  // change via recomputeTotal), so this always reflects the current form.
  const currentValues = form.getFieldsValue();
  const currentCustomerName = (currentValues.customerName || "").trim();
  const currentMatchedMember = customers.find(
    (c) => c.member && c.name.toLowerCase() === currentCustomerName.toLowerCase(),
  );
  const insufficientMember =
    currentMatchedMember &&
    currentValues.payment === "MEMBER" &&
    computedTotal > (currentMatchedMember.credit || 0)
      ? currentMatchedMember
      : null;

  const handleSubmit = () => {
    if (!therapist) return;

    form.validateFields().then(async (values) => {
      const rm = values.rm ?? 0;
      const coupon = values.coupon ?? 0;
      const oilText: string = values.oil || "";
      const total = rm + coupon + (Number(oilText) || 0);
      const customerName = (values.customerName || "").trim();

      const matchedMember = customers.find(
        (c) => c.member && c.name.toLowerCase() === customerName.toLowerCase(),
      );

      if (
        matchedMember &&
        values.payment === "MEMBER" &&
        total > (matchedMember.credit || 0)
      ) {
        message.error(
          `Insufficient balance — ${matchedMember.name} has RM ${(matchedMember.credit || 0).toFixed(2)}, this order needs RM ${total.toFixed(2)}`,
        );
        return;
      }

      setSaving(true);

      const result = await attachOrderToTherapist({
        date,
        therapistId: therapist.id,
        customerName,
        packageCode: values.packageCode,
        rm,
        coupon,
        oil: oilText,
        payment: values.payment,
      });

      if (!result.success) {
        setSaving(false);
        message.error(result.error || "Couldn't save — please try again");
        return;
      }

      // If this matches a real member and payment is MB, mirror the same
      // credit/session deduction the Member page's Form does.
      if (matchedMember && values.payment === "MEMBER") {
        if ((matchedMember.sessionsTotal ?? 0) > 0) {
          const nextUsed = Math.min(
            (matchedMember.sessionsUsed ?? 0) + 1,
            matchedMember.sessionsTotal ?? 0,
          );
          await updateCustomerSessionsUsed(matchedMember.id, nextUsed);
        }

        if (total > 0) {
          await updateCustomerCredit(matchedMember.id, (matchedMember.credit || 0) - total);
        }

        await logMemberVisit({
          customerId: matchedMember.id,
          type: "visit",
          therapistName: therapist.title,
          description: `${values.packageCode} with ${therapist.title}`,
          amount: total || undefined,
        });
      }

      setSaving(false);
      message.success(`Added to ${therapist.title}'s table`);
      form.resetFields();
      setComputedTotal(0);
      onSaved();
      onClose();
    });
  };

  return (
    <>
      <Modal
        title={therapist ? `New order — ${therapist.title}` : "New order"}
        open={!!therapist}
        onCancel={onClose}
        onOk={handleSubmit}
        okText="Submit"
        okButtonProps={{ disabled: !!insufficientMember }}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onValuesChange={recomputeTotal}>
          <Form.Item name="customerName" label="Customer (optional for walk-in)">
            <AutoComplete
              options={customerOptions}
              filterOption={(input, option) =>
                (option?.value ?? "").toLowerCase().includes(input.toLowerCase())
              }
              placeholder="Type or select a customer name"
            />
          </Form.Item>

          <Form.Item
            name="packageCode"
            label="Package"
            rules={[{ required: true, message: "Select the massage package" }]}
          >
            <Input
              readOnly
              placeholder="e.g. BD90"
              onClick={() => setPackageModalOpen(true)}
              style={{ cursor: "pointer" }}
              suffix={<span style={{ color: "#9CA3AF" }}>Select ›</span>}
            />
          </Form.Item>

          <Form.Item
            name="payment"
            label="Payment"
            rules={[{ required: true, message: "Select a payment type" }]}
          >
            <Select options={paymentOptions} placeholder="Select payment type" />
          </Form.Item>

          <div style={{ display: "flex", gap: 12 }}>
            <Form.Item name="rm" label="RM" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: "100%" }} placeholder="0" />
            </Form.Item>
            <Form.Item name="coupon" label="Coupon" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: "100%" }} placeholder="0" />
            </Form.Item>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <Form.Item name="oil" label="OIL / HS20 / NETT" style={{ flex: 1 }}>
              <Input style={{ width: "100%" }} placeholder="e.g. Lav or 0" />
            </Form.Item>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, marginBottom: 8 }}>Total</div>
              <div
                style={{
                  background: insufficientMember ? "#FBEAE5" : PRIMARY_SOFT,
                  color: insufficientMember ? "#C0533E" : PRIMARY,
                  fontWeight: 700,
                  fontSize: 14,
                  borderRadius: 8,
                  padding: "6.5px 11px",
                }}
              >
                RM {computedTotal.toFixed(2)}
              </div>
            </div>
          </div>

          {insufficientMember && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#FBEAE5",
                color: "#C0533E",
                fontSize: 12.5,
                fontWeight: 600,
                borderRadius: 8,
                padding: "9px 12px",
              }}
            >
              ⚠️ Insufficient balance — {insufficientMember.name} only has RM {(insufficientMember.credit || 0).toFixed(2)} available
            </div>
          )}
        </Form>
      </Modal>

      <Modal
        title="Select Package"
        open={packageModalOpen}
        onCancel={() => setPackageModalOpen(false)}
        footer={null}
        width={560}
        centered
        zIndex={2000}
      >
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <Input
            value={customPackageName}
            onChange={(e) => setCustomPackageName(e.target.value)}
            onPressEnter={applyCustomPackage}
            placeholder="Type custom package"
            style={{ textTransform: "uppercase" }}
          />
          <button
            onClick={applyCustomPackage}
            disabled={!customPackageName.trim()}
            style={{
              border: "1px solid #d9d9d9",
              borderRadius: 6,
              padding: "0 16px",
              background: customPackageName.trim() ? "#fff" : "#f5f5f5",
              cursor: customPackageName.trim() ? "pointer" : "not-allowed",
              color: customPackageName.trim() ? "#000" : "#bbb",
            }}
          >
            Apply
          </button>
        </div>

        {massagePackageSelectionGroups.map((group) => (
          <div
            key={group.title}
            style={{ background: group.background, padding: "12px 16px", border: "1px solid #e5e7eb", borderBottom: 0 }}
          >
            <div style={{ textAlign: "center", fontWeight: 600, marginBottom: 8 }}>{group.title}</div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${group.columns.length}, minmax(0, 1fr))`, gap: 8 }}>
              {group.columns.map((column, columnIndex) => (
                <div key={`${group.title}-${columnIndex}`} style={{ display: "grid", gap: 6, alignContent: "start" }}>
                  {column.map((choice) => (
                    <button
                      key={`${group.title}-${choice.code}-${choice.rm}-${choice.coupon}`}
                      onClick={() => applyPackageChoice(choice)}
                      title={`${choice.label} | RM ${choice.rm} + Coupon ${choice.coupon}`}
                      style={{ height: 28, padding: "0 6px", textAlign: "left", fontWeight: 500, background: "transparent", border: "none", cursor: "pointer", borderRadius: 4 }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.05)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {choice.code}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, border: "1px solid #e5e7eb", padding: "10px 16px" }}>
          {[
            { code: "OFF", label: "Therapist off day" },
            { code: "MC", label: "Medical leave" },
          ].map((choice) => (
            <button
              key={choice.code}
              onClick={() => applyPackageChoice({ code: choice.code, rm: 0, coupon: 0 })}
              title={choice.label}
              style={{
                height: 32,
                padding: "0 14px",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 600,
                border: choice.code === "OFF" ? "1px solid #C0533E" : "1px solid #d9d9d9",
                color: choice.code === "OFF" ? "#C0533E" : "#000",
                background: "#fff",
              }}
            >
              {choice.code}
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
};

export default Orders;
