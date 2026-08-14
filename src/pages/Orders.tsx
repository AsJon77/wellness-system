import React, { useEffect, useMemo, useState } from "react";
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

  // A therapist is "busy" if their latest booked session's time-out hasn't
  // passed yet. Available therapists are ordered so whoever has been idle
  // longest (or never worked today) comes first, and whoever just finished
  // a session rotates to the back of the line.
  const { availableList, busyList } = useMemo(() => {
    const nowStr = dayjs().tz(MYT).format(TIME_FORMAT);

    const statuses = therapists
      .filter((t) => t.title?.trim())
      .map((t) => {
        const timeOuts = t.entries.map((e) => e.timeOut).filter(Boolean) as string[];
        const latest = timeOuts.sort().slice(-1)[0] || null;
        const busy = !!latest && latest > nowStr;
        return { ...t, latest, busy };
      });

    const availableList = statuses
      .filter((t) => !t.busy)
      .sort((a, b) => (a.latest || "").localeCompare(b.latest || ""));

    const busyList = statuses
      .filter((t) => t.busy)
      .sort((a, b) => (a.latest || "").localeCompare(b.latest || ""));

    return { availableList, busyList };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [therapists, tick]);

  const male = availableList.filter((t) => genderOf(t.title) === "M");
  const female = availableList.filter((t) => genderOf(t.title) === "F");
  const other = availableList.filter((t) => genderOf(t.title) === "?");

  const Badge: React.FC<{ t: DailyTherapistBox }> = ({ t }) => {
    const g = genderOf(t.title);
    const bg = g === "M" ? MALE_BG : g === "F" ? FEMALE_BG : NEUTRAL_BG;
    const color = g === "M" ? MALE_TEXT : g === "F" ? FEMALE_TEXT : NEUTRAL_TEXT;
    return (
      <div
        onClick={() => setSelected(t)}
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
        }}
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
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#5C6B63", marginBottom: 12 }}>
                Available
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
                        <Badge key={t.id} t={t} />
                      ))}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                      {female.map((t) => (
                        <Badge key={t.id} t={t} />
                      ))}
                    </div>
                    {other.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 18 }}>
                        {other.map((t) => (
                          <Badge key={t.id} t={t} />
                        ))}
                      </div>
                    )}
                  </>
                )}

                <div style={{ borderTop: `1px solid ${LINE}`, marginTop: 18, paddingTop: 18 }}>
                  <div
                    onClick={() => setAddTherapistOpen(true)}
                    style={{
                      width: 56, height: 56, borderRadius: "50%",
                      border: `2px dashed #C4C9C6`, color: "#9CA3AF",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 18, cursor: "pointer",
                    }}
                    title="Add Therapist"
                  >
                    <PlusOutlined />
                  </div>
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
      Number(values.rm || 0) + Number(values.coupon || 0) + Number(values.oil || 0),
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

  const handleSubmit = () => {
    if (!therapist) return;

    form.validateFields().then(async (values) => {
      setSaving(true);

      const rm = values.rm ?? 0;
      const coupon = values.coupon ?? 0;
      const oil = values.oil ?? 0;
      const total = rm + coupon + oil;
      const customerName = (values.customerName || "").trim();

      const result = await attachOrderToTherapist({
        date,
        therapistId: therapist.id,
        customerName,
        packageCode: values.packageCode,
        rm,
        coupon,
        oil,
        payment: values.payment,
      });

      if (!result.success) {
        setSaving(false);
        message.error(result.error || "Couldn't save — please try again");
        return;
      }

      // If this matches a real member and payment is MB, mirror the same
      // credit/session deduction the Member page's Form does.
      const matchedMember = customers.find(
        (c) => c.member && c.name.toLowerCase() === customerName.toLowerCase(),
      );

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
              <InputNumber min={0} style={{ width: "100%" }} placeholder="0" />
            </Form.Item>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, marginBottom: 8 }}>Total</div>
              <div style={{ background: PRIMARY_SOFT, color: PRIMARY, fontWeight: 700, fontSize: 14, borderRadius: 8, padding: "6.5px 11px" }}>
                RM {computedTotal.toFixed(2)}
              </div>
            </div>
          </div>
        </Form>
      </Modal>

      <Modal
        title="Select Package"
        open={packageModalOpen}
        onCancel={() => setPackageModalOpen(false)}
        footer={null}
        width={560}
        centered
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
        <div style={{ border: "1px solid #e5e7eb", padding: "10px 16px" }} />
      </Modal>
    </>
  );
};

export default Orders;
