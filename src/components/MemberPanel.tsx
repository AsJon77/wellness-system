import React, { useEffect, useMemo, useState } from "react";
import {
  Drawer,
  Input,
  InputNumber,
  AutoComplete,
  Avatar,
  Empty,
  Tag,
  Modal,
  Form,
  Select,
  Spin,
  message,
} from "antd";
import {
  SearchOutlined,
  LeftOutlined,
  PlusOutlined,
  PhoneOutlined,
  DollarCircleOutlined,
  StarOutlined,
  ShoppingOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  FileTextOutlined,
  CheckSquareOutlined,
  TeamOutlined,
  MessageOutlined,
  FormOutlined,
  FileOutlined,
  SoundOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

import { Customer } from "../data/customers";
import {
  insertCustomer,
  updateCustomerSessionsUsed,
  updateCustomerCredit,
  topUpCustomerCredit,
  fetchMemberVisits,
  logMemberVisit,
  MemberVisit,
} from "../data/customersApi";
import {
  fetchTherapistTitlesForDate,
  attachMemberVisitToTherapist,
} from "../data/dailyRecordsApi";
import { massagePackageSelectionGroups } from "../data/massagePackages";

const MYT = "Asia/Kuala_Lumpur";
type Tab = "recent" | "new" | "birthday" | "name";

const PRIMARY = "#2F4F44";
const PRIMARY_SOFT = "#E7EEE9";
const ACCENT = "#C68A3E";
const ACCENT_SOFT = "#FBF0DE";

const initials = (name: string) =>
  name
    .replace(/\(.*\)/, "")
    .trim()
    .charAt(0)
    .toUpperCase() || "?";

type MemberPanelProps = {
  open: boolean;
  onClose: () => void;
  customers: Customer[];
  /** Optional: called when a member is picked while in "pick" mode (e.g. assigning to a table row) */
  onPickMember?: (customer: Customer) => void;
  /** Called after a new member is successfully saved to Supabase */
  onMemberAdded?: (customer: Customer) => void;
  /** Called after a member's record changes (session used, top-up, etc.) */
  onCustomerUpdated?: (customer: Customer) => void;
};

const MemberPanel: React.FC<MemberPanelProps> = ({
  open,
  onClose,
  customers,
  onPickMember,
  onMemberAdded,
  onCustomerUpdated,
}) => {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("recent");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const handleAddMember = () => {
    form.validateFields().then(async (values) => {
      setSaving(true);

      const newMember = await insertCustomer({
        name: values.name.trim(),
        phone: values.phone?.trim(),
        gender: values.gender,
      });

      setSaving(false);

      if (!newMember) {
        message.error("Couldn't save member — please try again");
        return;
      }

      onMemberAdded?.(newMember);
      message.success(`${newMember.name} added`);
      form.resetFields();
      setAddOpen(false);
      setTab("new");
    });
  };

  const filtered = useMemo(() => {
    let filteredList = [...customers];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filteredList = filteredList.filter(
        (c) =>
          c.name.toLowerCase().includes(q) || (c.phone || "").includes(q),
      );
    }

    if (tab === "recent") {
      filteredList.sort((a, b) =>
        (b.lastVisitAt || "").localeCompare(a.lastVisitAt || ""),
      );
    } else if (tab === "new") {
      filteredList.sort((a, b) =>
        (b.createdAt || "").localeCompare(a.createdAt || ""),
      );
    } else if (tab === "birthday") {
      const todayMD = dayjs().format("MM-DD");
      filteredList = filteredList.filter((c) => !!c.birthday);
      filteredList.sort((a, b) => {
        const da = a.birthday === todayMD ? "0" : a.birthday || "9";
        const db = b.birthday === todayMD ? "0" : b.birthday || "9";
        return da.localeCompare(db);
      });
    } else if (tab === "name") {
      filteredList.sort((a, b) => a.name.localeCompare(b.name));
    }

    return filteredList;
  }, [customers, search, tab]);

  const closeAll = () => {
    setSelected(null);
    setSearch("");
    setTab("recent");
    onClose();
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "recent", label: "Recent" },
    { key: "new", label: "New" },
    { key: "birthday", label: "Birthday" },
    { key: "name", label: "Name" },
  ];

  return (
    <Drawer
      open={open}
      onClose={closeAll}
      width={420}
      closable={false}
      styles={{ body: { padding: 0, background: "#F5F7F5" } }}
    >
      {!selected ? (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          {/* header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "18px 20px 12px",
            }}
          >
            <div
              onClick={closeAll}
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: "#fff",
                border: "1px solid #E4E9E5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: PRIMARY,
              }}
            >
              <LeftOutlined />
            </div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>
              Member{" "}
              <span style={{ color: "#5C6B63", fontWeight: 500, fontSize: 13 }}>
                ({customers.length})
              </span>
            </div>
            <div
              onClick={() => setAddOpen(true)}
              style={{
                marginLeft: "auto",
                width: 34,
                height: 34,
                borderRadius: 10,
                background: PRIMARY,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: 16,
              }}
              title="Add new member"
            >
              <PlusOutlined />
            </div>
          </div>

          {/* search */}
          <div style={{ padding: "0 20px 10px" }}>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              prefix={<SearchOutlined style={{ color: "#9CA3AF" }} />}
              placeholder="Search name or phone number"
              style={{ borderRadius: 12, height: 40 }}
            />
          </div>

          {/* tabs */}
          <div
            style={{
              display: "flex",
              gap: 22,
              padding: "4px 20px 12px",
              borderBottom: "1px solid #E4E9E5",
            }}
          >
            {tabs.map((t) => (
              <div
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  paddingBottom: 10,
                  color: tab === t.key ? PRIMARY : "#5C6B63",
                  borderBottom:
                    tab === t.key ? `2px solid ${PRIMARY}` : "2px solid transparent",
                }}
              >
                {t.label}
              </div>
            ))}
          </div>

          {/* list */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px 20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {filtered.length === 0 && (
              <Empty
                description="No members found"
                style={{ marginTop: 60 }}
              />
            )}

            {filtered.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelected(c)}
                style={{
                  background: "#fff",
                  border: "1px solid #E4E9E5",
                  borderRadius: 14,
                  padding: 14,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar
                    style={{ background: ACCENT_SOFT, color: ACCENT, fontWeight: 700 }}
                  >
                    {initials(c.name)}
                  </Avatar>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>
                      {c.name} {c.gender === "M" ? "♂" : c.gender === "F" ? "♀" : ""}
                      {c.member && (
                        <Tag color="gold" style={{ marginLeft: 6, fontSize: 10 }}>
                          MEMBER
                        </Tag>
                      )}
                    </div>
                    <div style={{ fontSize: 12.5, color: "#5C6B63" }}>
                      {c.phone || "No phone on file"}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12.5,
                    color: "#5C6B63",
                  }}
                >
                  <span>Sales</span>
                  <span>
                    {c.lastSaleAmount ? (
                      <strong style={{ color: PRIMARY }}>
                        RM {c.lastSaleAmount}
                      </strong>
                    ) : (
                      "No recent sales"
                    )}
                    {c.lastVisitAt
                      ? ` · ${dayjs(c.lastVisitAt).format("D MMM, h:mm A")}`
                      : ""}
                  </span>
                </div>

                {onPickMember && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onPickMember(c);
                      closeAll();
                    }}
                    style={{
                      alignSelf: "flex-end",
                      fontSize: 12,
                      fontWeight: 700,
                      color: ACCENT,
                      cursor: "pointer",
                    }}
                  >
                    Use for this row →
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <MemberDetail
          customer={selected}
          onBack={() => setSelected(null)}
          onPick={
            onPickMember
              ? () => {
                  onPickMember(selected);
                  closeAll();
                }
              : undefined
          }
          onUpdated={(updated) => {
            setSelected(updated);
            onCustomerUpdated?.(updated);
          }}
        />
      )}

      <Modal
        title="Add New Member"
        open={addOpen}
        onCancel={() => {
          setAddOpen(false);
          form.resetFields();
        }}
        onOk={handleAddMember}
        okText="Add Member"
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item
            name="name"
            label="Full name"
            rules={[{ required: true, message: "Please enter a name" }]}
          >
            <Input placeholder="e.g. Ariff Abdullah" />
          </Form.Item>
          <Form.Item name="phone" label="Phone number">
            <Input placeholder="e.g. 0123456789" />
          </Form.Item>
          <Form.Item name="gender" label="Gender" initialValue="F">
            <Select
              options={[
                { value: "F", label: "Female ♀" },
                { value: "M", label: "Male ♂" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Drawer>
  );
};

const MemberDetail: React.FC<{
  customer: Customer;
  onBack: () => void;
  onPick?: () => void;
  onUpdated?: (updated: Customer) => void;
}> = ({ customer: c, onBack, onPick, onUpdated }) => {
  const remaining = Math.max((c.sessionsTotal || 0) - (c.sessionsUsed || 0), 0);
  const [formOpen, setFormOpen] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [lastVisit, setLastVisit] = useState<MemberVisit | null>(null);

  useEffect(() => {
    fetchMemberVisits(c.id).then((visits) => {
      const mostRecent = visits.find((v) => v.type === "visit") || null;
      setLastVisit(mostRecent);
    });
  }, [c.id]);

  const comingSoon = (label: string) => message.info(`${label} — coming soon`);

  const quickActions = [
    { icon: <ClockCircleOutlined />, label: "Breakdown", onClick: () => setBreakdownOpen(true) },
    { icon: <FileTextOutlined />, label: "Remarks", onClick: () => comingSoon("Remarks") },
    { icon: <CheckSquareOutlined />, label: "Checklist", onClick: () => comingSoon("Checklist") },
    { icon: <TeamOutlined />, label: "Referral", onClick: () => comingSoon("Referral") },
    { icon: <MessageOutlined />, label: "Message", onClick: () => comingSoon("Message") },
    { icon: <FormOutlined />, label: "Form", onClick: () => setFormOpen(true) },
    { icon: <FileOutlined />, label: "Document", onClick: () => comingSoon("Document") },
    { icon: <SoundOutlined />, label: "Broadcast", onClick: () => comingSoon("Broadcast") },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 20px 12px" }}>
        <div
          onClick={onBack}
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: "#fff",
            border: "1px solid #E4E9E5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: PRIMARY,
          }}
        >
          <LeftOutlined />
        </div>
        <div style={{ fontSize: 17, fontWeight: 700 }}>Member Details</div>
        <div style={{ marginLeft: "auto", color: PRIMARY }}>
          <PhoneOutlined />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "4px 20px 24px" }}>
        {/* id card */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #E4E9E5",
            borderRadius: 16,
            padding: 18,
            marginBottom: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <Avatar size={52} style={{ background: PRIMARY_SOFT, color: PRIMARY, fontWeight: 700, fontSize: 18 }}>
              {initials(c.name)}
            </Avatar>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>
                {c.name} {c.gender === "M" ? "♂" : c.gender === "F" ? "♀" : ""}
              </div>
              <div style={{ fontSize: 13, color: "#5C6B63" }}>
                {c.phone || "No phone on file"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, paddingTop: 14, borderTop: "1px solid #E4E9E5" }}>
            <div
              onClick={() => setCreditsOpen(true)}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                borderRadius: 10,
                padding: 4,
                margin: -4,
              }}
              title="View credit history"
            >
              <div style={{ width: 30, height: 30, borderRadius: 8, background: PRIMARY_SOFT, color: PRIMARY, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <DollarCircleOutlined />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>RM {(c.credit || 0).toFixed(2)}</div>
                <div style={{ fontSize: 11, color: "#5C6B63" }}>Credit ›</div>
              </div>
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: ACCENT_SOFT, color: ACCENT, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <StarOutlined />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{c.points || 0}</div>
                <div style={{ fontSize: 11, color: "#5C6B63" }}>Points</div>
              </div>
            </div>
          </div>
        </div>

        {/* rows */}
        <div style={{ background: "#fff", border: "1px solid #E4E9E5", borderRadius: 14, marginBottom: 14 }}>
          <Row icon={<ShoppingOutlined />} label="Package" value={c.packageName ? `${c.packageName} (${remaining}/${c.sessionsTotal} left)` : "No active package"} />
          <div
            onClick={() => setRecentOpen(true)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", cursor: "pointer" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 600 }}>
              <ClockCircleOutlined /> Recent
            </div>
            <div style={{ fontSize: 13, color: "#5C6B63" }}>
              {lastVisit ? lastVisit.description : "No visits yet"} ›
            </div>
          </div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #E4E9E5", borderRadius: 14, marginBottom: 14 }}>
          <Row icon={<CalendarOutlined />} label="Member since" value={c.createdAt ? dayjs(c.createdAt).format("D MMM YYYY") : "-"} />
          <div style={{ padding: "13px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 600, marginBottom: lastVisit ? 6 : 0 }}>
              <ClockCircleOutlined /> Last visit
            </div>
            {lastVisit ? (
              <div style={{ fontSize: 12.5, color: "#5C6B63", paddingLeft: 24 }}>
                <div>{lastVisit.description || "Session"}</div>
                <div>
                  {lastVisit.branch} · {dayjs(lastVisit.date).format("D MMM YYYY")}, {lastVisit.time?.slice(0, 5)}
                  {lastVisit.amount ? ` · RM ${lastVisit.amount}` : ""}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: "#5C6B63", paddingLeft: 24 }}>-</div>
            )}
          </div>
        </div>

        {c.remark && (
          <div
            style={{
              background: ACCENT_SOFT,
              border: `1px solid ${ACCENT}33`,
              borderRadius: 14,
              padding: "12px 14px",
              marginBottom: 14,
              fontSize: 13,
              color: "#7a5a26",
            }}
          >
            📝 {c.remark}
          </div>
        )}

        {onPick && (
          <div
            onClick={onPick}
            style={{
              background: PRIMARY,
              color: "#fff",
              textAlign: "center",
              fontWeight: 700,
              borderRadius: 12,
              padding: "12px 0",
              marginBottom: 14,
              cursor: "pointer",
            }}
          >
            Use this member for the selected row
          </div>
        )}

        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#5C6B63", margin: "4px 0 10px" }}>
          Quick actions
        </div>
        <div style={{ background: "#fff", border: "1px solid #E4E9E5", borderRadius: 14, padding: "18px 12px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {quickActions.map((a) => (
              <div
                key={a.label}
                onClick={a.onClick}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer" }}
              >
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: PRIMARY_SOFT, color: PRIMARY, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>
                  {a.icon}
                </div>
                <div style={{ fontSize: 11, color: "#5C6B63", textAlign: "center" }}>{a.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <AssignVisitModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        customer={c}
        onAssigned={(updated) => {
          onUpdated?.(updated);
          fetchMemberVisits(c.id).then((visits) => {
            setLastVisit(visits.find((v) => v.type === "visit") || null);
          });
        }}
      />

      <BreakdownModal
        open={breakdownOpen}
        onClose={() => setBreakdownOpen(false)}
        customer={c}
      />

      <CreditsModal
        open={creditsOpen}
        onClose={() => setCreditsOpen(false)}
        customer={c}
        onToppedUp={(updated) => onUpdated?.(updated)}
      />

      <RecentModal
        open={recentOpen}
        onClose={() => setRecentOpen(false)}
        customer={c}
      />
    </div>
  );
};

const AssignVisitModal: React.FC<{
  open: boolean;
  onClose: () => void;
  customer: Customer;
  onAssigned: (updated: Customer) => void;
}> = ({ open, onClose, customer, onAssigned }) => {
  const [form] = Form.useForm();
  const [therapistOptions, setTherapistOptions] = useState<{ value: string }[]>([]);
  const [loadingTherapists, setLoadingTherapists] = useState(false);
  const [saving, setSaving] = useState(false);
  const [computedTotal, setComputedTotal] = useState(0);
  const [packageModalOpen, setPackageModalOpen] = useState(false);
  const [customPackageName, setCustomPackageName] = useState("");
  const today = dayjs().tz(MYT).format("YYYY-MM-DD");
  const remaining = Math.max((customer.sessionsTotal || 0) - (customer.sessionsUsed || 0), 0);

  useEffect(() => {
    if (!open) return;
    setLoadingTherapists(true);
    fetchTherapistTitlesForDate(today).then((titles) => {
      setTherapistOptions(titles.map((t) => ({ value: t })));
      setLoadingTherapists(false);
    });
  }, [open, today]);

  const recomputeTotal = () => {
    const values = form.getFieldsValue();
    const total =
      Number(values.rm || 0) + Number(values.coupon || 0) + (Number(values.oil) || 0);
    setComputedTotal(total);
  };

  const applyPackageChoice = (choice: { code: string; rm: number; coupon: number }) => {
    form.setFieldsValue({
      packageCode: choice.code,
      rm: choice.rm,
      coupon: choice.coupon,
    });
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

  const handleSubmit = () => {
    form.validateFields().then(async (values) => {
      setSaving(true);

      const rm = values.rm ?? 0;
      const coupon = values.coupon ?? 0;
      const oilText: string = values.oil || "";
      const total = rm + coupon + (Number(oilText) || 0);

      const result = await attachMemberVisitToTherapist({
        date: today,
        therapistTitle: values.therapist.trim(),
        customerName: customer.name,
        packageCode: values.packageCode,
        rm,
        coupon,
        oil: oilText,
        total,
      });

      if (!result.success) {
        setSaving(false);
        message.error(result.error || "Couldn't save — please try again");
        return;
      }

      let updatedCustomer = customer;

      if (customer.member && (customer.sessionsTotal ?? 0) > 0) {
        const nextUsed = Math.min(
          (customer.sessionsUsed ?? 0) + 1,
          customer.sessionsTotal ?? 0,
        );
        await updateCustomerSessionsUsed(customer.id, nextUsed);
        updatedCustomer = { ...updatedCustomer, sessionsUsed: nextUsed };
      }

      // The Total (RM + Coupon + Oil) is the package price — that's what
      // gets deducted from the member's credit balance, not just RM alone.
      if (total > 0) {
        const nextCredit = (customer.credit || 0) - total;
        await updateCustomerCredit(customer.id, nextCredit);
        updatedCustomer = { ...updatedCustomer, credit: nextCredit };
      }

      await logMemberVisit({
        customerId: customer.id,
        type: "visit",
        therapistName: values.therapist.trim(),
        description: `${values.packageCode} with ${values.therapist.trim()}`,
        amount: total || undefined,
      });

      setSaving(false);
      message.success(`Added to ${values.therapist.trim()}'s table — payment set to MB`);
      form.resetFields();
      setComputedTotal(0);
      onAssigned(updatedCustomer);
      onClose();
    });
  };

  return (
    <Modal
      title={`Assign visit — ${customer.name}`}
      open={open}
      onCancel={() => {
        form.resetFields();
        setComputedTotal(0);
        onClose();
      }}
      onOk={handleSubmit}
      okText="Submit"
      confirmLoading={saving}
      destroyOnClose
    >
      <div style={{ fontSize: 13, color: "#5C6B63", marginBottom: 14 }}>
        {customer.packageName
          ? `${customer.packageName} — ${remaining}/${customer.sessionsTotal} sessions left`
          : "No active package — this will still be logged as a member visit"}
      </div>

      <Form form={form} layout="vertical" onValuesChange={recomputeTotal}>
        <Form.Item
          name="therapist"
          label="Therapist"
          rules={[{ required: true, message: "Select or type a therapist name" }]}
          extra="Select today's therapist, or type a new name to add one"
        >
          <AutoComplete
            options={therapistOptions}
            filterOption={(input, option) =>
              (option?.value ?? "").toLowerCase().includes(input.toLowerCase())
            }
            placeholder={loadingTherapists ? "Loading today's therapists…" : "e.g. 19M"}
            disabled={loadingTherapists}
          />
        </Form.Item>

        <Form.Item
          name="packageCode"
          label="Package performed"
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
                background: PRIMARY_SOFT,
                color: PRIMARY,
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

        <div style={{ fontSize: 12, color: "#5C6B63", marginTop: -4 }}>
          Total (RM + Coupon + Oil) is the package price — this is what gets deducted from {customer.name}'s credit balance.
        </div>
      </Form>

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
            style={{
              background: group.background,
              padding: "12px 16px",
              border: "1px solid #e5e7eb",
              borderBottom: 0,
            }}
          >
            <div style={{ textAlign: "center", fontWeight: 600, marginBottom: 8 }}>
              {group.title}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${group.columns.length}, minmax(0, 1fr))`,
                gap: 8,
              }}
            >
              {group.columns.map((column, columnIndex) => (
                <div key={`${group.title}-${columnIndex}`} style={{ display: "grid", gap: 6, alignContent: "start" }}>
                  {column.map((choice) => (
                    <button
                      key={`${group.title}-${choice.code}-${choice.rm}-${choice.coupon}`}
                      onClick={() => applyPackageChoice(choice)}
                      title={`${choice.label} | RM ${choice.rm} + Coupon ${choice.coupon}`}
                      style={{
                        height: 28,
                        padding: "0 6px",
                        textAlign: "left",
                        fontWeight: 500,
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        borderRadius: 4,
                      }}
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
    </Modal>
  );
};

const BreakdownModal: React.FC<{
  open: boolean;
  onClose: () => void;
  customer: Customer;
}> = ({ open, onClose, customer }) => {
  const [visits, setVisits] = useState<MemberVisit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchMemberVisits(customer.id).then((list) => {
      setVisits(list.filter((v) => v.type === "visit"));
      setLoading(false);
    });
  }, [open, customer.id]);

  return (
    <Modal
      title={`Breakdown — ${customer.name}`}
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      {loading ? (
        <div style={{ textAlign: "center", padding: 30 }}>
          <Spin />
        </div>
      ) : visits.length === 0 ? (
        <Empty description="No visits recorded yet" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 420, overflowY: "auto" }}>
          {visits.map((v) => (
            <div
              key={v.id}
              style={{
                border: "1px solid #E4E9E5",
                borderRadius: 10,
                padding: "10px 12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  🧖 Visit{v.therapistName ? ` · ${v.therapistName}` : ""}
                </div>
                <div style={{ fontSize: 12, color: "#5C6B63", marginTop: 2 }}>
                  {v.description || "Session"}
                </div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                  {v.branch}
                </div>
              </div>
              <div style={{ fontSize: 11, color: "#5C6B63", textAlign: "right", whiteSpace: "nowrap" }}>
                {dayjs(v.date).format("D MMM YYYY")}
                <br />
                {v.time?.slice(0, 5)}
                {v.amount ? (
                  <>
                    <br />
                    <span style={{ color: "#C0533E", fontWeight: 700 }}>
                      - RM {v.amount.toFixed(2)}
                    </span>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};

const RecentModal: React.FC<{
  open: boolean;
  onClose: () => void;
  customer: Customer;
}> = ({ open, onClose, customer }) => {
  const [visits, setVisits] = useState<MemberVisit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchMemberVisits(customer.id).then((list) => {
      setVisits(list.filter((v) => v.type === "visit"));
      setLoading(false);
    });
  }, [open, customer.id]);

  const groups = useMemo(() => {
    const map = new Map<string, MemberVisit[]>();
    visits.forEach((v) => {
      const key = dayjs(v.date).format("DD/MM/YYYY");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
    });
    return Array.from(map.entries());
  }, [visits]);

  return (
    <Modal
      title={`Recent — ${customer.name}`}
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      {loading ? (
        <div style={{ textAlign: "center", padding: 30 }}>
          <Spin />
        </div>
      ) : groups.length === 0 ? (
        <Empty description="No visits recorded yet" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxHeight: 460, overflowY: "auto" }}>
          {groups.map(([date, items]) => (
            <div key={date}>
              <div style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 600, marginBottom: 8 }}>
                {date}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((v) => (
                  <div
                    key={v.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      background: "#F5F7F5",
                      border: "1px solid #E4E9E5",
                      borderRadius: 12,
                      padding: "10px 12px",
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: PRIMARY_SOFT,
                        color: PRIMARY,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 17,
                        flexShrink: 0,
                      }}
                    >
                      🧖
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {v.description || "Session"}
                      </div>
                      {v.amount ? (
                        <div style={{ fontSize: 12.5, color: "#5C6B63", marginTop: 2 }}>
                          {v.amount.toFixed(2)}
                        </div>
                      ) : null}
                    </div>
                    <div style={{ color: "#C4C9C6", fontSize: 14 }}>›</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};

const CreditsModal: React.FC<{
  open: boolean;
  onClose: () => void;
  customer: Customer;
  onToppedUp: (updated: Customer) => void;
}> = ({ open, onClose, customer, onToppedUp }) => {
  const [transactions, setTransactions] = useState<MemberVisit[]>([]);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState(customer.credit || 0);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    fetchMemberVisits(customer.id).then((list) => {
      // Only entries that moved money: visits with an amount (redeems), top-ups, and refunds
      const money = list.filter(
        (v) =>
          v.type === "topup" ||
          v.type === "refund" ||
          (v.type === "visit" && v.amount),
      );
      setTransactions(money);
      setLoading(false);
    });
  };

  useEffect(() => {
    if (open) {
      setBalance(customer.credit || 0);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer.id]);

  // transactions are newest-first from the API; walk backwards from the
  // current balance to compute the running balance after each one.
  const withRunningBalance = useMemo(() => {
    let runningBalance = balance;
    return transactions.map((t) => {
      const balanceAfter = runningBalance;
      const delta =
        t.type === "topup" || t.type === "refund" ? t.amount || 0 : -(t.amount || 0);
      runningBalance = runningBalance - delta;
      return { ...t, balanceAfter };
    });
  }, [transactions, balance]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof withRunningBalance>();
    withRunningBalance.forEach((t) => {
      const key = dayjs(t.date).format("MMMM YYYY").toUpperCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return Array.from(map.entries());
  }, [withRunningBalance]);

  const handleAddTopUp = () => {
    addForm.validateFields().then(async (values) => {
      setSaving(true);
      const newCredit = await topUpCustomerCredit(customer, values.amount, values.note);
      setSaving(false);

      if (newCredit === null) {
        message.error("Couldn't save top-up — please try again");
        return;
      }

      message.success("Top-up recorded");
      addForm.resetFields();
      setAddOpen(false);
      setBalance(newCredit);
      onToppedUp({ ...customer, credit: newCredit });
      load();
    });
  };

  return (
    <Modal open={open} onCancel={onClose} footer={null} destroyOnClose width={420}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 13, color: "#5C6B63", fontWeight: 600 }}>Balance</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: PRIMARY }}>{balance.toFixed(2)}</div>
        </div>
        <div
          onClick={() => setAddOpen(true)}
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            border: `1.5px solid ${PRIMARY}`,
            color: PRIMARY,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            cursor: "pointer",
          }}
          title="Add top-up"
        >
          <PlusOutlined />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 30 }}>
          <Spin />
        </div>
      ) : groups.length === 0 ? (
        <Empty description="No credit history yet" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxHeight: 440, overflowY: "auto" }}>
          {groups.map(([month, items]) => (
            <div key={month}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.04em", marginBottom: 8 }}>
                {month}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      background: "#F5F7F5",
                      borderRadius: 12,
                      padding: "10px 12px",
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background:
                          t.type === "topup" ? PRIMARY : t.type === "refund" ? ACCENT : "#fff",
                        color: t.type === "topup" || t.type === "refund" ? "#fff" : "#5C6B63",
                        border:
                          t.type === "topup" || t.type === "refund" ? "none" : "1px solid #E4E9E5",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 15,
                        flexShrink: 0,
                      }}
                    >
                      <DollarCircleOutlined />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                        {t.type === "topup" ? "Topup" : t.type === "refund" ? "Refund" : "Redeem"}
                      </div>
                      <div style={{ fontSize: 11.5, color: "#5C6B63" }}>
                        {dayjs(`${t.date} ${t.time}`).format("h:mm A, DD/MM/YYYY")}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 700,
                          color:
                            t.type === "topup" ? "#2F9E5B" : t.type === "refund" ? ACCENT : "#C0533E",
                        }}
                      >
                        {t.type === "topup" || t.type === "refund" ? "+" : "-"}
                        {(t.amount || 0).toFixed(2)}
                      </div>
                      <div style={{ fontSize: 11.5, color: PRIMARY }}>
                        {t.balanceAfter.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        title="Add top-up"
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        onOk={handleAddTopUp}
        okText="Save"
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={addForm} layout="vertical">
          <Form.Item
            name="amount"
            label="Amount (RM)"
            rules={[{ required: true, message: "Enter an amount" }]}
          >
            <InputNumber min={0.01} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="note" label="Note">
            <Input placeholder="e.g. Cash top-up at counter" />
          </Form.Item>
        </Form>
      </Modal>
    </Modal>
  );
};

const Row: React.FC<{ icon: React.ReactNode; label: string; value: string; last?: boolean }> = ({
  icon,
  label,
  value,
  last,
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "13px 16px",
      borderBottom: last ? "none" : "1px solid #E4E9E5",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 600 }}>
      {icon} {label}
    </div>
    <div style={{ fontSize: 13, color: "#5C6B63" }}>{value}</div>
  </div>
);

export default MemberPanel;
