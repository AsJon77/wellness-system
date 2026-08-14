import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, message } from "antd";
import {
  TeamOutlined,
  ShoppingCartOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  FieldTimeOutlined,
  SoundOutlined,
  MessageOutlined,
  QuestionCircleOutlined,
  AlertOutlined,
  DollarCircleOutlined,
  BellOutlined,
  LogoutOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { supabase } from "../supabase";
import { fetchCustomers } from "../data/customersApi";

const PRIMARY = "#2F4F44";
const PRIMARY_SOFT = "#E7EEE9";
const ACCENT = "#C68A3E";
const ACCENT_SOFT = "#FBF0DE";
const BLUE = "#3E5A8C";
const BLUE_SOFT = "#E9EEF7";
const PURPLE = "#7A4C99";
const PURPLE_SOFT = "#F2E9F7";
const DANGER = "#C0533E";
const DANGER_SOFT = "#FBEAE5";
const BG = "#F5F7F5";
const LINE = "#E4E9E5";

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [memberCount, setMemberCount] = useState<number | null>(null);

  useEffect(() => {
    fetchCustomers().then((list) => setMemberCount(list.length));
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const comingSoon = (label: string) => message.info(`${label} — coming soon`);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 480, padding: "20px 18px 60px" }}>
        {/* top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: `linear-gradient(135deg, ${PRIMARY}, #47705F)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 20,
            }}
          >
            🧘
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em" }}>
            Zenland Wellness
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <Badge count={0} size="small">
              <IconButton icon={<BellOutlined />} onClick={() => comingSoon("Notifications")} />
            </Badge>
            <IconButton icon={<LogoutOutlined />} onClick={handleLogout} title="Logout" />
          </div>
        </div>

        {/* primary tiles */}
        <BigTile
          icon={<FileTextOutlined />}
          iconBg={BLUE_SOFT}
          iconColor={BLUE}
          label="Daily System"
          onClick={() => navigate("/daily")}
        />
        <BigTile
          icon={<TeamOutlined />}
          iconBg={PRIMARY_SOFT}
          iconColor={PRIMARY}
          label="Member"
          value={memberCount !== null ? memberCount.toLocaleString() : "…"}
          onClick={() => navigate("/members")}
        />
        <BigTile
          icon={<ShoppingCartOutlined />}
          iconBg={ACCENT_SOFT}
          iconColor={ACCENT}
          label="Orders"
          onClick={() => navigate("/orders")}
        />
        <BigTile
          icon={<CalendarOutlined />}
          iconBg={BLUE_SOFT}
          iconColor={BLUE}
          label="Appointment"
          onClick={() => comingSoon("Appointment")}
        />
        <BigTile
          icon={<ClockCircleOutlined />}
          iconBg={PURPLE_SOFT}
          iconColor={PURPLE}
          label="History"
          onClick={() => navigate("/history")}
        />

        <SectionLabel>Operations</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <SmallTile
            icon={<FieldTimeOutlined />}
            iconBg={ACCENT_SOFT}
            iconColor={ACCENT}
            label="Attendance"
            onClick={() => comingSoon("Attendance")}
          />
          <SmallTile
            icon={<SoundOutlined />}
            iconBg={DANGER_SOFT}
            iconColor={DANGER}
            label="Announcement"
            onClick={() => comingSoon("Announcement")}
          />
          <SmallTile
            icon={<MessageOutlined />}
            iconBg={BLUE_SOFT}
            iconColor={BLUE}
            label="Customer 360"
            onClick={() => comingSoon("Customer 360")}
          />
          <SmallTile
            icon={<QuestionCircleOutlined />}
            iconBg={PRIMARY_SOFT}
            iconColor={PRIMARY}
            label="Help Center"
            onClick={() => comingSoon("Help Center")}
          />
          <SmallTile
            icon={<AlertOutlined />}
            iconBg={DANGER_SOFT}
            iconColor={DANGER}
            label="SOS"
            onClick={() => comingSoon("SOS")}
          />
          <SmallTile
            icon={<DollarCircleOutlined />}
            iconBg={ACCENT_SOFT}
            iconColor={ACCENT}
            label="Shift Report"
            onClick={() => navigate("/dashboard")}
          />
        </div>
      </div>
    </div>
  );
};

const IconButton: React.FC<{
  icon: React.ReactNode;
  onClick: () => void;
  title?: string;
}> = ({ icon, onClick, title }) => (
  <div
    onClick={onClick}
    title={title}
    style={{
      width: 38,
      height: 38,
      borderRadius: 10,
      background: "#fff",
      border: `1px solid ${LINE}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      fontSize: 16,
      color: PRIMARY,
    }}
  >
    {icon}
  </div>
);

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      padding: "10px 2px 8px",
      fontSize: 12,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      color: "#5C6B63",
    }}
  >
    {children}
  </div>
);

const BigTile: React.FC<{
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value?: string;
  onClick: () => void;
}> = ({ icon, iconBg, iconColor, label, value, onClick }) => (
  <div
    onClick={onClick}
    style={{
      background: "#fff",
      border: `1px solid ${LINE}`,
      borderRadius: 16,
      boxShadow: "0 1px 2px rgba(30,38,34,0.04), 0 6px 20px rgba(30,38,34,0.06)",
      padding: "16px 18px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      cursor: "pointer",
      marginBottom: 12,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: iconBg,
          color: iconColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 19,
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: 15.5, fontWeight: 600 }}>{label}</div>
    </div>
    <div style={{ fontSize: 16, fontWeight: 700, color: PRIMARY }}>
      {value !== undefined ? value : "›"}
    </div>
  </div>
);

const SmallTile: React.FC<{
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  onClick: () => void;
}> = ({ icon, iconBg, iconColor, label, onClick }) => (
  <div
    onClick={onClick}
    style={{
      background: "#fff",
      border: `1px solid ${LINE}`,
      borderRadius: 16,
      boxShadow: "0 1px 2px rgba(30,38,34,0.04), 0 6px 20px rgba(30,38,34,0.06)",
      padding: 16,
      display: "flex",
      flexDirection: "column",
      gap: 10,
      cursor: "pointer",
    }}
  >
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        background: iconBg,
        color: iconColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 17,
      }}
    >
      {icon}
    </div>
    <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
  </div>
);

export default Home;
