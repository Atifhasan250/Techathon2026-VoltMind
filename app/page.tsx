/* eslint-disable react/no-unescaped-entities */
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Device as BackendDevice, PowerSummary, Alert as BackendAlert, StreamEvent, EnergyAnalytics } from "@/lib/types";
import Image from "next/image";
import {
  Activity,
  Bell,
  Boxes,
  ChartNoAxesCombined,
  ChevronRight,
  CircleAlert,
  Clock3,
  DoorOpen,
  Fan,
  Gauge,
  LayoutDashboard,
  Lightbulb,
  CheckCircle2,
  PanelLeftClose,
  PanelLeftOpen,
  Projector,
  RadioTower,
  Snowflake,
  TriangleAlert,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

type View = "dashboard" | "rooms" | "analytics" | "alerts";
type Device = {
  id: string;
  name: string;
  type: string;
  watts: number;
  on: boolean;
  updated: string;
};
type Room = {
  name: string;
  code: string;
  color: string;
  devices: Device[];
};

const nav: { id: View; label: string; Icon: LucideIcon }[] = [
  { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { id: "rooms", label: "Rooms", Icon: DoorOpen },
  { id: "analytics", label: "Analytics", Icon: ChartNoAxesCombined },
  { id: "alerts", label: "Alerts", Icon: TriangleAlert },
];

const metricIcons: Record<string, LucideIcon> = {
  "Total Devices": Boxes,
  "Active Devices": Activity,
  "Current Power": Gauge,
  "Today's Energy": Zap,
  "Active Alerts": CircleAlert,
};

const initialRooms: Room[] = [
  {
    name: "Drawing Room",
    code: "DR",
    color: "#0F3B2E",
    devices: [],
  },
  {
    name: "Work Room 1",
    code: "WR1",
    color: "#2E7D5B",
    devices: [],
  },
  {
    name: "Work Room 2",
    code: "WR2",
    color: "#6366F1",
    devices: [],
  },
];


function backendToFrontendId(backendId: string): string {
  const parts = backendId.split("-");
  const index = parts.pop();
  const type = parts.pop();
  const roomSlug = parts.join("-");
  const code = roomSlug === "drawing-room" ? "DR" : roomSlug === "work-room-1" ? "WR1" : "WR2";
  const t = type === "light" ? "L" : "F";
  return `${code}-${t}${index}`;
}

function formatRelativeTime(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

const alerts = [
  {
    title: "High Power Usage",
    desc: "Drawing Room consuming 285W — 42% above baseline threshold.",
    room: "Drawing Room",
    time: "2 min ago",
    level: "Critical",
    color: "#E85D5D",
  },
  {
    title: "Fan Running After Hours",
    desc: "WR1-Fan-02 active outside scheduled hours (after 8 PM).",
    room: "Work Room 1",
    time: "18 min ago",
    level: "Warning",
    color: "#F4B942",
  },
  {
    title: "Light On in Empty Room",
    desc: "WR2-Light-03 active in an unoccupied zone for more than 30 minutes.",
    room: "Work Room 2",
    time: "34 min ago",
    level: "Info",
    color: "#2E7D5B",
  },
];

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`card ${className}`}>{children}</section>;
}
function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
    </div>
  );
}
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const min = Math.min(...values),
    max = Math.max(...values),
    spread = max - min || 1;
  const points = values
    .map(
      (v, i) =>
        `${i * (100 / (values.length - 1))},${36 - ((v - min) / spread) * 27}`,
    )
    .join(" ");
  return (
    <svg className="spark" viewBox="0 0 100 40" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function DeviceGlyph({ type, on }: { type: string; on: boolean }) {
  const Icon =
    type === "Light"
      ? Lightbulb
      : type === "Fan"
        ? Fan
        : type === "AC"
          ? Snowflake
          : type === "Projector"
            ? Projector
            : RadioTower;
  return (
    <span
      className={`device-glyph ${on ? "is-on" : ""} ${type === "Fan" && on ? "fan" : ""}`}
    >
      <Icon size={14} strokeWidth={2} />
    </span>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rooms, setRooms] = useState<Room[]>(initialRooms);
  const [powerSummary, setPowerSummary] = useState<PowerSummary | null>(null);
  const [liveAlerts, setLiveAlerts] = useState<BackendAlert[]>([]);
  const [now, setNow] = useState(new Date());
  const [powerHistory, setPowerHistory] = useState<number[]>([]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const es = new EventSource("/api/sse");

    const updateDevices = (backendDevices: BackendDevice[]) => {
      setRooms((prevRooms) =>
        prevRooms.map((room) => {
          const roomBackendDevices = backendDevices.filter((d) => d.room === room.name);
          const mappedDevices = roomBackendDevices.map((d) => ({
            id: backendToFrontendId(d.id),
            name: d.name,
            type: d.type === "fan" ? "Fan" : "Light",
            watts: d.wattage,
            on: d.status === "on",
            updated: formatRelativeTime(d.lastChanged),
          }));

          const mergedDevices = mappedDevices.map((md) => {
            const originalMatch = room.devices.find((d) => d.id === md.id);
            return originalMatch ? { ...originalMatch, ...md, type: originalMatch.type } : md;
          });

          return { ...room, devices: mergedDevices };
        })
      );
    };

    es.addEventListener("snapshot", (e) => {
      const data = JSON.parse(e.data) as StreamEvent & { type: "snapshot" };
      updateDevices(data.data.devices);
      setPowerSummary(data.data.power);
      setLiveAlerts(data.data.alerts);
      setPowerHistory((prev) => [...prev.slice(-6), data.data.power.totalWatts]);
    });

    es.addEventListener("state-changed", (e) => {
      const data = JSON.parse(e.data) as StreamEvent & { type: "state-changed" };
      setRooms((prevRooms) =>
        prevRooms.map((room) => {
          if (room.name !== data.data.device.room) return room;
          const mapped = {
            id: backendToFrontendId(data.data.device.id),
            name: data.data.device.name,
            type: data.data.device.type === "fan" ? "Fan" : "Light",
            watts: data.data.device.wattage,
            on: data.data.device.status === "on",
            updated: formatRelativeTime(data.data.device.lastChanged),
          };
          return {
            ...room,
            devices: room.devices.map((d) => (d.id === mapped.id ? { ...d, ...mapped } : d)),
          };
        })
      );
      setPowerSummary(data.data.power);
      setLiveAlerts(data.data.alerts);
      setPowerHistory((prev) => [...prev.slice(-6), data.data.power.totalWatts]);
    });

    es.addEventListener("alerts-changed", (e) => {
      const data = JSON.parse(e.data) as StreamEvent & { type: "alerts-changed" };
      setLiveAlerts(data.data.alerts);
    });

    return () => es.close();
  }, []);

  const devices = rooms.flatMap((room) => room.devices);
  const activeCount = powerSummary ? powerSummary.devicesOn : devices.filter((device) => device.on).length;
  const totalPower = powerSummary ? powerSummary.totalWatts : devices.filter((device) => device.on).reduce((sum, device) => sum + device.watts, 0);

  const page = useMemo(
    () =>
      view === "dashboard" ? (
        <Dashboard
          rooms={rooms}
          active={activeCount}
          totalPower={totalPower}
          powerSummary={powerSummary}
          liveAlerts={liveAlerts}
          powerHistory={powerHistory}
        />
      ) : view === "rooms" ? (
        <Rooms rooms={rooms} />
      ) : view === "analytics" ? (
        <Analytics />
      ) : (
        <Alerts liveAlerts={liveAlerts} />
      ),
    [view, rooms, activeCount, totalPower, powerSummary, liveAlerts, powerHistory],
  );
  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarCollapsed ? "is-collapsed" : ""}`}>
        <button
          className="sidebar-collapse"
          type="button"
          onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen size={18} />
          ) : (
            <PanelLeftClose size={18} />
          )}
        </button>
        <nav>
          {nav.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              onClick={() => setView(id)}
            >
              <span>
                <Icon size={18} />
              </span>
              <span className="nav-label">{label}</span>
              <ChevronRight className="nav-chevron" size={13} />
            </button>
          ))}
        </nav>
        {!sidebarCollapsed && (
          <div className="system-card">
            <i style={liveAlerts.length > 0 ? { background: liveAlerts.some(a => a.severity === "critical") ? "#E85D5D" : "#F4B942", boxShadow: `0 0 9px ${liveAlerts.some(a => a.severity === "critical") ? "#E85D5D" : "#F4B942"}` } : {}} />
            <span>{liveAlerts.length > 0 ? `${liveAlerts.length} Active Alert${liveAlerts.length > 1 ? "s" : ""}` : "All Systems Normal"}</span>
            <small>
              {activeCount} / {devices.length} devices active
            </small>
          </div>
        )}
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="header-brand">
            <Image
              src="/logo.jpeg"
              width={42}
              height={42}
              alt="VoltMind logo"
            />
            <strong>VoltMind</strong>
          </div>
          <div className="clock">
            <Clock3 size={14} />
            <b>
              {now.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </b>
            <span>
              {now.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
          <button className="bell" aria-label="Notifications" onClick={() => setView("alerts")}>
            <Bell size={16} />
            {liveAlerts.length > 0 && <i />}
          </button>
        </header>
        <main>{page}</main>
      </div>
      <nav className="bottom-nav">
        {nav.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={view === id ? "active" : ""}
            onClick={() => setView(id)}
          >
            <span>
              <Icon size={17} />
            </span>
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function Dashboard({
  rooms,
  active,
  totalPower,
  powerSummary,
  liveAlerts,
  powerHistory,
}: {
  rooms: Room[];
  active: number;
  totalPower: number;
  powerSummary: PowerSummary | null;
  liveAlerts: BackendAlert[];
  powerHistory: number[];
}) {
  const totalDevices = rooms.flatMap(r => r.devices).length;

  // Compute power trend badge dynamically from rolling history
  const powerAvg = powerHistory.length > 1
    ? powerHistory.slice(0, -1).reduce((s, v) => s + v, 0) / (powerHistory.length - 1)
    : totalPower;
  const powerDelta = powerAvg > 0 ? Math.round(((totalPower - powerAvg) / powerAvg) * 100) : 0;
  const powerBadge = powerHistory.length < 2
    ? "Calculating…"
    : powerDelta === 0
      ? "Stable"
      : `${powerDelta > 0 ? "+" : ""}${powerDelta}% vs avg`;

  // Use rolling power history for sparkline, pad with current value if too short
  const powerSparkline = powerHistory.length >= 2
    ? powerHistory
    : Array(7).fill(totalPower);

  // Active devices rolling sparkline: approximate from current ratio
  const activeSparkline = powerHistory.length >= 2
    ? powerHistory.map(w => Math.round((w / (powerHistory.reduce((s,v) => s+v,0)/powerHistory.length || 1)) * active))
    : Array(7).fill(active);

  const todayKwh = powerSummary?.estimatedDailyKwh ?? 0;
  const energySparkline = powerHistory.length >= 2
    ? powerHistory.map(w => Number(((w * 8) / 1000).toFixed(2)))
    : Array(7).fill(todayKwh);

  const metrics = [
    [
      "Total Devices",
      String(totalDevices),
      `${totalDevices} registered`,
      "#0F3B2E",
      Array(7).fill(totalDevices),
    ],
    [
      "Active Devices",
      String(active),
      `${Math.round((active / Math.max(totalDevices, 1)) * 100)}% uptime`,
      "#3BA55C",
      activeSparkline,
    ],
    [
      "Current Power",
      `${totalPower}W`,
      powerBadge,
      "#F4B942",
      powerSparkline,
    ],
    [
      "Today's Energy",
      powerSummary ? `${powerSummary.estimatedDailyKwh} kWh` : "—",
      "On track",
      "#2E7D5B",
      energySparkline,
    ],
    [
      "Active Alerts",
      String(liveAlerts.length),
      `${liveAlerts.filter((a) => a.severity === "critical").length} critical`,
      "#E85D5D",
      Array(7).fill(liveAlerts.length),
    ],
  ] as const;

  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      <div className="page-heading">
        <h1>Office Overview</h1>
        <p>
          Smart Office Control&nbsp; · &nbsp;{todayLabel}&nbsp; ·
          &nbsp;{liveAlerts.length > 0 ? `${liveAlerts.length} alert${liveAlerts.length > 1 ? "s" : ""} active` : "All systems operational"}
        </p>
      </div>
      <div className="metrics">
        {metrics.map(([label, value, badge, color, values]) => {
          const MetricIcon = metricIcons[label];
          return (
            <Card key={label} className="metric">
              <div
                className="metric-icon"
                style={{ color, background: `${color}12` }}
              >
                <MetricIcon size={17} strokeWidth={2} />
              </div>
              <div>
                <p>{label}</p>
                <strong>{value}</strong>
                <small>{badge}</small>
              </div>
              <Sparkline values={[...values]} color={color} />
            </Card>
          );
        })}
      </div>
      <div className="dashboard-grid">
        <FloorPlan rooms={rooms} />
        <div className="side-stack">
          <LiveAlerts liveAlerts={liveAlerts} />
          <PowerAnalytics powerSummary={powerSummary} />
        </div>
      </div>
    </>
  );
}

function FloorPlan({ rooms }: { rooms: Room[] }) {
  const getStatus = (id: string) => {
    for (const room of rooms) {
      const device = room.devices.find((d) => d.id === id);
      if (device) return device.on;
    }
    return false;
  };

  const fixtures = [
    {
      room: "Drawing Room",
      lights: [
        [9, 11, getStatus("DR-L1")],
        [18, 11, getStatus("DR-L2")],
        [27, 11, getStatus("DR-L3")],
      ],
      fans: [
        [12, 62, getStatus("DR-F1")],
        [26, 62, getStatus("DR-F2")],
      ],
    },
    {
      room: "Work Room 1",
      lights: [
        [41, 11, getStatus("WR1-L1")],
        [50, 11, getStatus("WR1-L2")],
        [59, 11, getStatus("WR1-L3")],
      ],
      fans: [
        [42, 62, getStatus("WR1-F1")],
        [58, 62, getStatus("WR1-F2")],
      ],
    },
    {
      room: "Work Room 2",
      lights: [
        [72, 11, getStatus("WR2-L1")],
        [82, 11, getStatus("WR2-L2")],
        [92, 11, getStatus("WR2-L3")],
      ],
      fans: [
        [75, 62, getStatus("WR2-F1")],
        [91, 62, getStatus("WR2-F2")],
      ],
    },
  ] as const;

  return (
    <Card className="floor-card">
      <SectionTitle title="Office Floor Plan" />
      <div className="floor-plan-photo">
        <Image
          className="office-room-image"
          src="/office-room.jpeg"
          alt="Top view of the Drawing Room, Work Room 1, and Work Room 2"
          fill
          loading="eager"
          sizes="(max-width: 1180px) 100vw, 65vw"
        />
        {fixtures.map((room) => (
          <div key={room.room}>
            {room.lights.map(([left, top, on], index) => (
              <span
                className={`floor-fixture floor-light ${on ? "is-on" : "is-off"}`}
                style={{ left: `${left}%`, top: `${top}%` }}
                title={`${room.room} light ${index + 1} ${on ? "on" : "off"}`}
                key={`${room.room}-light-${index}`}
              >
                <Image src="/light.png" alt="" width={34} height={34} priority />
              </span>
            ))}
            {room.fans.map(([left, top, on], index) => (
              <span
                className={`floor-fixture floor-fan ${on ? "is-on" : "is-off"}`}
                style={{ left: `${left}%`, top: `${top}%` }}
                title={`${room.room} fan ${index + 1} ${on ? "on" : "off"}`}
                key={`${room.room}-fan-${index}`}
              >
                <Image src="/fan.png" alt="" width={48} height={48} priority />
              </span>
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}
function LiveAlerts({ liveAlerts }: { liveAlerts: BackendAlert[] }) {
  if (liveAlerts.length === 0) {
    return (
      <Card>
        <div className="title-row">
          <h2>Live Alerts</h2>
          <span className="live">
            <i style={{ background: "#3BA55C", boxShadow: "0 0 7px #3BA55C" }} /> 0 active
          </span>
        </div>
        <div style={{ fontSize: "13px", color: "var(--muted)", padding: "10px 0" }}>
          No active alerts. All systems running optimally.
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="title-row">
        <h2>Live Alerts</h2>
        <span className="live">
          <i />{liveAlerts.length} active
        </span>
      </div>
      <div className="alert-list">
        {liveAlerts.map((alert) => (
          <div
            className="alert"
            key={alert.id}
            style={{ 
              borderColor: alert.severity === "critical" ? "#E85D5D" : "#F4B942", 
              background: alert.severity === "critical" ? "#E85D5D09" : "#F4B94209" 
            }}
          >
            <b>{alert.type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</b>
            <em style={{ 
              color: alert.severity === "critical" ? "#E85D5D" : "#F4B942", 
              background: alert.severity === "critical" ? "#E85D5D18" : "#F4B94218" 
            }}>
              {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
            </em>
            <p>{alert.message}</p>
            <small>
              <span>{alert.room}</span>
              {formatRelativeTime(alert.timestamp)}
            </small>
          </div>
        ))}
      </div>
    </Card>
  );
}
type ChartSample = { averageWatts: number; timestamp?: string };

function generatePath(samples: ChartSample[], width: number, height: number) {
  if (!samples || !samples.length) return `M0 ${height} L${width} ${height}`;
  const max = Math.max(...samples.map(s => s.averageWatts), 1);
  const min = Math.min(...samples.map(s => s.averageWatts), 0) * 0.8;
  const range = Math.max(max - min, 1);
  const step = width / Math.max(samples.length - 1, 1);
  return samples.map((s, i) => {
    const x = i * step;
    const y = height - ((s.averageWatts - min) / range) * height;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

function getSamplePoints(samples: ChartSample[], width: number, height: number) {
  if (!samples?.length) return [];
  const max = Math.max(...samples.map(s => s.averageWatts), 1);
  const min = Math.min(...samples.map(s => s.averageWatts), 0) * 0.8;
  const range = Math.max(max - min, 1);
  const step = width / Math.max(samples.length - 1, 1);
  return samples.map((s, i) => ({
    x: i * step,
    y: height - ((s.averageWatts - min) / range) * height,
    watts: s.averageWatts,
    timestamp: s.timestamp,
  }));
}

type TooltipState = { svgX: number; svgY: number; pxX: number; pxY: number; label: string; sub: string } | null;

function LineChart({
  samples,
  height = 110,
  color = "#2E7D5B",
  style,
}: {
  samples: ChartSample[];
  height?: number;
  color?: string;
  style?: React.CSSProperties;
}) {
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const WIDTH = 340;
  const pathD = generatePath(samples, WIDTH, height);
  const points = getSamplePoints(samples, WIDTH, height);

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    if (!points.length) return;
    const closest = points.reduce((best, p) =>
      Math.abs(p.x - relX) < Math.abs(best.x - relX) ? p : best
    );
    setTooltip({
      svgX: closest.x,
      svgY: closest.y,
      pxX: (closest.x / WIDTH) * rect.width,
      pxY: (closest.y / height) * rect.height,
      label: `${Math.round(closest.watts)}W`,
      sub: closest.timestamp
        ? new Date(closest.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "",
    });
  }

  return (
    <div style={{ position: "relative", ...style }}>
      <svg
        className="line-chart"
        viewBox={`0 0 ${WIDTH} ${height}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: `${height}px`, display: "block", cursor: samples.length ? "crosshair" : "default" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        <path d={pathD} fill="none" stroke={color} strokeWidth="3" />
        <path d={`${pathD} L${WIDTH} ${height} L0 ${height}Z`} fill={`${color}18`} />
        {tooltip && (
          <>
            <line
              x1={tooltip.svgX} y1={0}
              x2={tooltip.svgX} y2={height}
              stroke={color} strokeWidth="1" strokeDasharray="4 3" opacity="0.5"
            />
            <circle
              cx={tooltip.svgX} cy={tooltip.svgY}
              r="5" fill={color} stroke="white" strokeWidth="2"
            />
          </>
        )}
      </svg>
      {tooltip && (
            <div
          style={{
            position: "absolute",
            top: Math.max(tooltip.pxY - 60, 4),
            left: `clamp(0px, calc(${(tooltip.svgX / WIDTH) * 100}% - 44px), calc(100% - 88px))`,
            background: "#0F3B2E",
            color: "#fff",
            borderRadius: 10,
            padding: "7px 12px",
            fontSize: 12,
            fontWeight: 600,
            pointerEvents: "none",
            zIndex: 10,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 18px rgba(15,59,46,.35)",
            lineHeight: 1.5,
            transition: "left 0.08s ease, top 0.08s ease",
          }}
        >
          <span style={{ fontSize: 16 }}>{tooltip.label}</span>
          {tooltip.sub && (
            <span style={{ display: "block", fontWeight: 400, opacity: 0.72, fontSize: 11 }}>
              {tooltip.sub}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function AnalyticsChart({ samples, height = 160 }: { samples: ChartSample[]; height?: number }) {
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const CHART_WIDTH = 340;
  const Y_TICKS = 4;

  const watts = samples.map(s => s.averageWatts);
  const maxW = Math.max(...watts, 1);
  const minW = Math.min(...watts, 0) * 0.9;
  const rangeW = Math.max(maxW - minW, 1);

  const points = samples.map((s, i) => ({
    x: i * (CHART_WIDTH / Math.max(samples.length - 1, 1)),
    y: height - ((s.averageWatts - minW) / rangeW) * height,
    watts: s.averageWatts,
    timestamp: s.timestamp,
  }));

  const pathD = points.length
    ? points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
    : `M0 ${height} L${CHART_WIDTH} ${height}`;

  // Y-axis ticks (bottom → top)
  const yTicks = Array.from({ length: Y_TICKS + 1 }, (_, i) => ({
    label: `${Math.round(minW + (rangeW / Y_TICKS) * i)}W`,
    y: height - (i / Y_TICKS) * height,
  }));

  // X-axis ticks: up to 5 evenly spaced
  const xCount = Math.min(samples.length, 5);
  const xTicks = samples.length > 1
    ? Array.from({ length: xCount }, (_, i) => {
        const idx = Math.round((i / (xCount - 1)) * (samples.length - 1));
        return {
          x: idx * (CHART_WIDTH / Math.max(samples.length - 1, 1)),
          label: samples[idx]?.timestamp
            ? new Date(samples[idx].timestamp!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '',
        };
      })
    : [];

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * CHART_WIDTH;
    if (!points.length) return;
    const closest = points.reduce((best, p) =>
      Math.abs(p.x - relX) < Math.abs(best.x - relX) ? p : best
    );
    setTooltip({
      svgX: closest.x,
      svgY: closest.y,
      pxX: (closest.x / CHART_WIDTH) * rect.width,
      pxY: (closest.y / height) * rect.height,
      label: `${Math.round(closest.watts)}W`,
      sub: closest.timestamp
        ? new Date(closest.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '',
    });
  }

  const Y_AXIS_W = 42;

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex' }}>
        {/* Y-axis */}
        <div style={{ width: Y_AXIS_W, flexShrink: 0, position: 'relative', height }}>
          {yTicks.map((t, i) => (
            <span key={i} style={{
              position: 'absolute', right: 8, top: t.y - 7,
              fontSize: 10, color: 'var(--muted)', lineHeight: 1, whiteSpace: 'nowrap',
            }}>{t.label}</span>
          ))}
        </div>
        {/* Chart */}
        <div style={{ flex: 1, position: 'relative' }}>
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${height}`}
            preserveAspectRatio="none"
            style={{ width: '100%', height, display: 'block', cursor: samples.length ? 'crosshair' : 'default' }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setTooltip(null)}
          >
            {yTicks.map((t, i) => (
              <line key={i} x1={0} y1={t.y} x2={CHART_WIDTH} y2={t.y}
                stroke="#e8e4de" strokeWidth="1" />
            ))}
            <path d={pathD} fill="none" stroke="#2E7D5B" strokeWidth="2.5" strokeLinejoin="round" />
            <path d={`${pathD} L${CHART_WIDTH} ${height} L0 ${height}Z`} fill="#2E7D5B14" />
            {tooltip && (
              <>
                <line x1={tooltip.svgX} y1={0} x2={tooltip.svgX} y2={height}
                  stroke="#2E7D5B" strokeWidth="1" strokeDasharray="4 3" opacity="0.45" />
                <circle cx={tooltip.svgX} cy={tooltip.svgY} r="5" fill="#2E7D5B" stroke="white" strokeWidth="2" />
              </>
            )}
          </svg>
          {/* X-axis labels */}
          <div style={{ position: 'relative', height: 20, marginTop: 4 }}>
            {xTicks.map((t, i) => (
              <span key={i} style={{
                position: 'absolute',
                left: `${(t.x / CHART_WIDTH) * 100}%`,
                transform: 'translateX(-50%)',
                fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap',
              }}>{t.label}</span>
            ))}
          </div>
          {/* Hover tooltip card */}
          {tooltip && (
            <div style={{
              position: 'absolute',
              top: Math.max(tooltip.pxY - 60, 4),
              left: `clamp(0px, calc(${(tooltip.svgX / CHART_WIDTH) * 100}% - 44px), calc(100% - 88px))`,
              background: '#0F3B2E', color: '#fff',
              borderRadius: 10, padding: '7px 12px',
              fontSize: 12, fontWeight: 600,
              pointerEvents: 'none', zIndex: 10,
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 18px rgba(15,59,46,.35)',
              lineHeight: 1.5,
            }}>
              <span style={{ fontSize: 16 }}>{tooltip.label}</span>
              {tooltip.sub && <span style={{ display: 'block', fontWeight: 400, opacity: 0.72, fontSize: 11 }}>{tooltip.sub}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PowerAnalytics({ powerSummary }: { powerSummary: PowerSummary | null }) {
  const [filter, setFilter] = useState<"live" | "day" | "week">("live");
  const [data, setData] = useState<EnergyAnalytics | null>(null);

  useEffect(() => {
    const range = filter === "live" ? "8h" : filter === "day" ? "24h" : "7d";
    fetch(`/api/analytics?range=${range}`)
      .then((res) => res.json())
      .then((json) => setData(json.analytics))
      .catch(console.error);
  }, [filter]);

  return (
    <Card>
      <div className="title-row">
        <h2>Power Analytics</h2>
        <div className="tabs">
          {filter === "live" ? <b>Live</b> : <span style={{ cursor: "pointer" }} onClick={() => setFilter("live")}>Live</span>}
          {filter === "day" ? <b>Day</b> : <span style={{ cursor: "pointer" }} onClick={() => setFilter("day")}>Day</span>}
          {filter === "week" ? <b>Week</b> : <span style={{ cursor: "pointer" }} onClick={() => setFilter("week")}>Week</span>}
        </div>
      </div>
      <div className="chart-label">
        <span>Power (W) — last {filter === "live" ? "8 hours" : filter === "day" ? "24 hours" : "7 days"}</span>
        <b>
          {filter === "live" ? powerSummary?.totalWatts || 0 : Math.round(data?.peakWatts || 0)}W
          {filter !== "live" && <small style={{ fontSize: 11, fontWeight: 400, opacity: 0.6, marginLeft: 4 }}>Peak</small>}
        </b>
      </div>
      <LineChart samples={data?.samples || []} height={110} />
      <b className="subhead">Room Breakdown</b>
      {Object.entries((filter === "live" ? powerSummary?.perRoom : data?.perRoomKwh) || { "Drawing Room": 0, "Work Room 1": 0, "Work Room 2": 0 }).map(([name, val]) => {
        const total = filter === "live" ? Math.max(powerSummary?.totalWatts || 1, 1) : Math.max(data?.actualEnergyKwh || 1, 1);
        const pct = (val / total) * 100;
        const color = name.includes("Drawing") ? "#0F3B2E" : name.includes("1") ? "#2E7D5B" : "#94A3B8";
        return (
          <div className="progress-row" key={String(name)}>
            <span>{name}</span>
            <b style={{ color: String(color) }}>{filter === "live" ? `${Math.round(val)}W` : `${val.toFixed(2)}kWh`}</b>
            <div>
              <i style={{ width: `${pct}%`, background: String(color) }} />
            </div>
          </div>
        );
      })}
    </Card>
  );
}

function DeviceTable({ rooms }: { rooms: Room[] }) {
  const allDevices = rooms.flatMap((r) => r.devices);
  const total = allDevices.length;
  const active = allDevices.filter((d) => d.on).length;
  const offline = total - active;
  return (
    <Card>
      <div className="title-row">
        <div>
          <h2>Live Device Status</h2>
          <p>{total} total · {active} active · {offline} offline</p>
        </div>
        <div className="filters">
          <span>All Rooms</span>
          <span>Filter</span>
        </div>
      </div>
      <div className="device-head">
        <span>Device Name</span>
        <span>Type</span>
        <span>Status</span>
        <span>Power</span>
        <span>Last Updated</span>
      </div>
      {rooms.map((room) => (
        <div className="device-group" key={room.code}>
          <b className="room-label">
            <i />
            {room.name}
          </b>
          {room.devices.map((device) => (
            <div className="device-row" key={device.id}>
              <span>
                <DeviceGlyph type={device.type} on={device.on} />
                <b>{device.name}</b>
              </span>
              <span>{device.type}</span>
              <span className={device.on ? "status on" : "status"}>
                <i />
                {device.on ? "ON" : "OFF"}
              </span>
              <strong>{device.on ? `${device.watts}W` : "—"}</strong>
              <span>{device.updated}</span>
            </div>
          ))}
        </div>
      ))}
    </Card>
  );
}

function Rooms({ rooms }: { rooms: Room[] }) {
  const allDevices = rooms.flatMap((r) => r.devices);
  const totalDevices = allDevices.length;
  const active = allDevices.filter((d) => d.on).length;
  const totalPower = allDevices.filter(d => d.on).reduce((sum, d) => sum + d.watts, 0);
  return (
    <>
      <div className="page-heading split">
        <div>
          <h1>Rooms</h1>
          <p>Live status for each office room</p>
        </div>
        <span className="monitor">
          <i />
          Live monitoring
        </span>
      </div>

      <div className="room-grid">
        {rooms.map((room) => {
          const on = room.devices.filter((d) => d.on);
          const power = on.reduce((sum, device) => sum + device.watts, 0);
          const fansActive = on.filter(
            (device) => device.type === "Fan",
          ).length;
          const lightsActive = on.filter(
            (device) => device.type === "Light",
          ).length;
          return (
            <Card className="room-card" key={room.code}>
              <div className="room-cover" style={{ background: room.color }}>
                <h2>{room.name}</h2>
                <p>Office Room</p>
                <span>
                  {on.length}/{room.devices.length} active
                </span>
              </div>
              <div className="room-insights">
                <div>
                  <Fan size={18} />
                  <strong>{fansActive}</strong>
                  <span>{fansActive === 1 ? "fan" : "fans"} active</span>
                </div>
                <div>
                  <Lightbulb size={18} />
                  <strong>{lightsActive}</strong>
                  <span>{lightsActive === 1 ? "light" : "lights"} active</span>
                </div>
                <div>
                  <Zap size={18} />
                  <strong>{power}W</strong>
                  <span>power usage</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <div className="room-metrics">
        <Card>
          <p>Total Rooms</p>
          <b>{rooms.length}</b>
          <small>offices</small>
        </Card>
        <Card>
          <p>Active Devices</p>
          <b>{active}</b>
          <small>of {totalDevices}</small>
        </Card>
        <Card>
          <p>Total Power</p>
          <b>{totalPower}</b>
          <small>watts now</small>
        </Card>
      </div>
      <DeviceTable rooms={rooms} />
    </>
  );
}

type AnalyticsRange = "24h" | "7d" | "30d";

const RANGE_LABELS: Record<AnalyticsRange, { label: string; sub: string; energyLabel: string }> = {
  "24h": { label: "24h",  sub: "Last 24 hours · All rooms", energyLabel: "24h Energy" },
  "7d":  { label: "7d",   sub: "Last 7 days · All rooms",   energyLabel: "7d Energy" },
  "30d": { label: "30d",  sub: "Last 30 days · All rooms",  energyLabel: "30d Energy" },
};

function Analytics() {
  const [range, setRange] = useState<AnalyticsRange>("24h");
  const [data, setData] = useState<EnergyAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setData(null);
    fetch(`/api/analytics?range=${range}`)
      .then((res) => res.json())
      .then((json) => { setData(json.analytics); setLoading(false); })
      .catch(() => setLoading(false));
  }, [range]);

  const meta = RANGE_LABELS[range];

  return (
    <>
      <div className="page-heading">
        <h1>Energy Analytics</h1>
        <p>Energy intelligence · {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
      </div>
      <div className="analytics-metrics">
        <Card>
          <p>{meta.energyLabel}</p>
          <b>
            {loading ? "—" : data?.actualEnergyKwh.toFixed(2)} <small>kWh</small>
          </b>
          <span>{data?.persistenceEnabled ? "from db" : "live session"}</span>
        </Card>
        <Card>
          <p>Estimated Cost</p>
          <b>৳{loading ? "—" : Math.round((data?.actualEnergyKwh || 0) * 12)}</b>
          <span>Based on 12৳/kWh</span>
        </Card>
        <Card>
          <p>Peak Demand</p>
          <b>
            {loading ? "—" : data?.peakWatts} <small>W</small>
          </b>
          <span>in this period</span>
        </Card>
        <Card>
          <p>Carbon Saved</p>
          <b>
            {loading ? "—" : ((data?.actualEnergyKwh || 0) * 0.4).toFixed(2)} <small>kg</small>
          </b>
          <span>Est. CO₂ reduction</span>
        </Card>
      </div>
      <Card className="energy-trend">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>{meta.sub}</p>
          <div className="tabs">
            {(Object.keys(RANGE_LABELS) as AnalyticsRange[]).map((r) =>
              r === range
                ? <b key={r} style={{ cursor: 'pointer' }} onClick={() => setRange(r)}>{RANGE_LABELS[r].label}</b>
                : <span key={r} style={{ cursor: 'pointer' }} onClick={() => setRange(r)}>{RANGE_LABELS[r].label}</span>
            )}
          </div>
        </div>
        {loading ? (
          <div style={{ height: 182, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>
            Loading chart data…
          </div>
        ) : (
          <AnalyticsChart samples={data?.samples || []} height={160} />
        )}
      </Card>
      <div className="analytics-grid">
        <Card>
          <SectionTitle
            title="Room Comparison"
            sub={`${meta.label} breakdown by room`}
          />
          {loading || !data ? (
            <div style={{ color: "var(--muted)", fontSize: 13, padding: "12px 0" }}>Loading…</div>
          ) : Object.entries(data.perRoomKwh || {}).map(([name, v]) => {
            const max = Math.max(...Object.values(data.perRoomKwh || { _: 1 }));
            const p = (v / (max || 1)) * 100;
            const c = name.includes("Drawing") ? "#0F3B2E" : name.includes("1") ? "#2E7D5B" : "#6366F1";
            return (
              <div className="comparison" key={String(name)}>
                <span>{name}</span>
                <div>
                  <i style={{ width: `${p}%`, background: String(c) }} />
                </div>
                <b>{v.toFixed(2)} kWh</b>
              </div>
            );
          })}
        </Card>
        <Card>
          <SectionTitle title="Top Energy Consumers" />
          {loading || !data ? (
            <div style={{ color: "var(--muted)", fontSize: 13, padding: "12px 0" }}>Loading…</div>
          ) : Object.entries(data.perRoomKwh || {})
              .sort(([, a], [, b]) => b - a)
              .map(([name, v], i) => (
                <div className="consumer" key={name}>
                  <b>{name}</b>
                  <span style={{ color: "var(--muted)" }}>#{i + 1} consumer</span>
                  <strong>{v.toFixed(2)} kWh</strong>
                </div>
              ))
          }
        </Card>
      </div>
    </>
  );
}

function Alerts({ liveAlerts }: { liveAlerts: BackendAlert[] }) {
  const [filter, setFilter] = useState("all");
  const [history, setHistory] = useState<BackendAlert[]>([]);
  const [seenAlerts, setSeenAlerts] = useState<BackendAlert[]>([]);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  // Fetch history on mount and occasionally
  useEffect(() => {
    let active = true;
    const fetchHistory = () => {
      fetch("/api/alerts/history")
        .then((res) => res.json())
        .then((data) => {
          if (active) setHistory(data.alerts || []);
        })
        .catch((err) => console.error("Failed to fetch alert history:", err));
    };
    
    fetchHistory();
    const interval = setInterval(fetchHistory, 60000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const liveAlertsStr = liveAlerts.map(a => `${a.id}-${a.timestamp}`).join(",");

  // When liveAlerts changes, accumulate into seenAlerts buffer
  // so resolved alerts appear in graph immediately
  useEffect(() => {
    if (liveAlerts.length > 0) {
      setSeenAlerts((prev) => {
        const existingKeys = new Set(prev.map((a) => `${a.id}-${a.timestamp}`));
        const newOnes = liveAlerts.filter((a) => !existingKeys.has(`${a.id}-${a.timestamp}`));
        return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
      });
    }
  }, [liveAlertsStr]);

  const critical = liveAlerts.filter(a => a.severity === "critical").length;
  const warning = liveAlerts.filter(a => a.severity === "warning").length;

  const counts = new Array(7).fill(0);
  
  const seen = new Set<string>();
  // Include seenAlerts so resolved alerts still show in the graph
  const allAlerts = [...liveAlerts, ...seenAlerts, ...history].filter(a => {
    const key = `${a.id}-${a.timestamp}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  allAlerts.forEach(a => {
    const alertTime = new Date(a.timestamp).getTime();
    if (Date.now() - alertTime <= 7 * 86_400_000) {
      const dayIndex = (new Date(a.timestamp).getDay() + 6) % 7;
      counts[dayIndex]++;
    }
  });

  // Apply filter
  const filteredAlerts = filter === "all"
    ? liveAlerts
    : filter === "critical"
      ? liveAlerts.filter(a => a.severity === "critical")
      : filter === "warning"
        ? liveAlerts.filter(a => a.severity === "warning")
        : liveAlerts;

  const filterOptions = [
    { key: "all", label: "All" },
    { key: "critical", label: "Critical", count: critical },
    { key: "warning", label: "Warning", count: warning },
  ];

  return (
    <>
      <div className="severity-grid">
        {[
          ["Critical", critical, "#E85D5D"],
          ["Warning", warning, "#F4B942"],
          ["Active", liveAlerts.length, "#2E7D5B"],
        ].map(([label, count, color]) => (
          <Card key={String(label)}>
            <p>{label}</p>
            <b style={{ color: String(color) }}>{count}</b>
            <small>active alerts</small>
            <span style={{ color: String(color), background: `${color}12` }}>
              <TriangleAlert size={22} />
            </span>
          </Card>
        ))}
      </div>
      <div className="alert-toolbar" style={{ paddingTop: '1rem' }}>
        <div>
          {filterOptions.map(({ key, label, count }) => (
            <button
              key={key}
              className={filter === key ? "active" : ""}
              onClick={() => setFilter(key)}
            >
              {label}{count !== undefined ? ` (${count})` : ""}
            </button>
          ))}
        </div>
        <span>{filteredAlerts.length} alert{filteredAlerts.length !== 1 ? "s" : ""} shown</span>
      </div>
      <div className="full-alerts">
        {liveAlerts.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 1rem', background: 'var(--bg-card)', borderRadius: 16, border: '1px solid rgba(0,0,0,0.04)', color: 'var(--muted)', textAlign: 'center', gridColumn: '1 / -1' }}>
            <CheckCircle2 size={48} style={{ color: '#2E7D5B', marginBottom: '1rem', opacity: 0.8 }} />
            <h3 style={{ margin: 0, color: 'var(--fg)', fontSize: '1.2rem', fontWeight: 600 }}>All Clear!</h3>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>There are no active alerts at the moment.</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const color = alert.severity === "critical" ? "#E85D5D" : "#F4B942";
            return (
              <div
                key={alert.id}
                style={{ borderColor: color, background: `${color}09` }}
              >
                <span style={{ color: color, background: `${color}15` }}>
                  <TriangleAlert size={18} />
                </span>
                <section>
                  <h3>
                    {alert.type.replace(/-/g, " ")}{" "}
                    <em style={{ color: color, background: `${color}18` }}>
                      {alert.severity}
                    </em>
                  </h3>
                  <p>{alert.message}</p>
                  <small>
                    <b>{alert.room}</b> <Clock3 size={10} /> {formatRelativeTime(alert.timestamp)}
                  </small>
                </section>
                <button aria-label={`Dismiss ${alert.type}`}>
                  <X size={14} />
                </button>
              </div>
            );
          })
        )}
      </div>
      <Card>
        <h3>Alert Frequency — Last 7 Days</h3>
        <div className="frequency">
          {counts.map((v, i) => {
            const day = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i];
            return (
              <div
                key={i}
                style={{ position: "relative" }}
                className="freq-bar-wrap"
              >
                <i
                  style={{ height: `${Math.max(v * 15, 4)}px` }}
                  onMouseEnter={() => v > 0 && setHoveredBar(i)}
                  onMouseLeave={() => setHoveredBar(null)}
                />
                <span>{day}</span>
                {hoveredBar === i && v > 0 && (
                  <div className="freq-tooltip">
                    <b>{v}</b> alert{v !== 1 ? "s" : ""}
                    <small>{day}</small>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}
