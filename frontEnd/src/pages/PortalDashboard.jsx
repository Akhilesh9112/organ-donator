import CareEmblem from "../components/ui/CareEmblem";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Heart,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { authFetch, openMedicalFile } from "../config/api";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import EmptyState from "../components/ui/EmptyState";
import Skeleton from "../components/ui/Skeleton";
import StatCard from "../components/ui/StatCard";
import Toast from "../components/ui/Toast";
import "./PortalDashboard.css";
const organs = ["Kidney", "Liver", "Heart", "Lungs", "Pancreas", "Cornea"];
const bloods = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const id = (r) => r?._id || r?.id;
const name = (r) => r?.fullName || r?.name || "—";
const date = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      })
    : "—";
const time = (value) =>
  value
    ? new Date(value).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      })
    : "—";
const navs = {
  donor: [
    ["overview", "Overview", LayoutDashboard],
    ["pledges", "My pledges", Heart],
    ["cases", "Consent requests", ClipboardCheck],
    ["documents", "Medical documents", FileText],
    ["appointments", "Appointments", CalendarDays],
    ["settings", "Care settings", Settings],
  ],
  recipient: [
    ["overview", "Overview", LayoutDashboard],
    ["cases", "My care timeline", Activity],
    ["recommendations", "Recommendations", HeartPulse],
    ["documents", "Medical documents", FileText],
    ["appointments", "Appointments", CalendarDays],
    ["settings", "Care settings", Settings],
  ],
  hospital: [
    ["overview", "Overview", LayoutDashboard],
    ["cases", "Care cases", HeartPulse],
    ["documents", "Document review", FileText],
    ["screening", "Screening workspace", ClipboardCheck],
    ["appointments", "Appointments", CalendarDays],
    ["settings", "Hospital profile", Building2],
  ],
  admin: [
    ["overview", "Overview", LayoutDashboard],
    ["users", "People & access", Users],
    ["hospitals", "Hospital verification", Building2],
    ["cases", "All care cases", HeartPulse],
    ["audit", "Audit trail", ShieldCheck],
    ["delivery", "Email delivery", Bell],
    ["settings", "Account", Settings],
  ],
};
function Field({ label, children }) {
  return (
    <label className="care-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Select({ options, ...props }) {
  return (
    <select {...props}>
      {options.map((v) =>
        Array.isArray(v) ? (
          <option key={v[0]} value={v[0]}>
            {v[1]}
          </option>
        ) : (
          <option key={v}>{v}</option>
        ),
      )}
    </select>
  );
}
function DataTable({
  rows,
  columns,
  empty = "No records to show",
  filter = "",
  rowKey = id,
}) {
  const [page, setPage] = useState(0);
  const filtered = useMemo(
    () =>
      rows.filter((r) =>
        JSON.stringify(r).toLowerCase().includes(filter.toLowerCase()),
      ),
    [rows, filter],
  );
  useEffect(() => setPage(0), [filter, rows]);
  const pages = Math.max(1, Math.ceil(filtered.length / 8));
  if (!filtered.length)
    return (
      <EmptyState
        title={empty}
        message={
          filter
            ? "Try another search or clear your filters."
            : "Your care team’s updates will appear here."
        }
      />
    );
  return (
    <>
      <div className="care-table-scroll">
        <table className="care-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.label} scope="col">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(page * 8, page * 8 + 8).map((r, i) => (
              <tr key={rowKey(r) || i}>
                {columns.map((c) => (
                  <td key={c.label}>{c.render(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="care-pagination">
        <span>
          {filtered.length} record{filtered.length !== 1 ? "s" : ""}
        </span>
        <div>
          <Button
            secondary
            aria-label="Previous page"
            disabled={!page}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft size={16} />
          </Button>
          <span>
            {page + 1} / {pages}
          </span>
          <Button
            secondary
            aria-label="Next page"
            disabled={page >= pages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>
    </>
  );
}
function Timeline({ row }) {
  const stages = [
      "Pending",
      "Accepted",
      "Hospital Review",
      "Scheduled",
      "Completed",
    ],
    active = stages.indexOf(row.status);
  return (
    <div className="care-timeline" aria-label={`Case progress: ${row.status}`}>
      {stages.map((s, i) => (
        <div key={s} className={i <= active ? "done" : ""}>
          <span>{i < active ? <Check size={12} /> : i + 1}</span>
          <small>
            {
              [
                "Consent",
                "Donor approved",
                "Hospital review",
                "Scheduled",
                "Completed",
              ][i]
            }
          </small>
        </div>
      ))}
    </div>
  );
}
export default function PortalDashboard() {
  const { user, logout, refreshUser } = useAuth(),
    role = user.role,
    uid = user.userId,
    token = user.token;
  const navigation = navs[role] || navs.recipient;
  const [tab, setTab] = useState(
      () => window.location.hash.slice(1) || "overview",
    ),
    [mobile, setMobile] = useState(false),
    [data, setData] = useState({}),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [filter, setFilter] = useState(""),
    [dialog, setDialog] = useState(null),
    [busy, setBusy] = useState(false),
    [formError, setFormError] = useState(""),
    [toast, setToast] = useState(""),
    [screen, setScreen] = useState(null),
    [screenLoading, setScreenLoading] = useState(false);
  const verified = role !== "hospital" || user.verificationState === "Verified";
  const go = useCallback((key) => {
    window.location.hash = key;
    setTab(key);
    setMobile(false);
    setFilter("");
  }, []);
  useEffect(() => {
    const h = () => {
      setTab(window.location.hash.slice(1) || "overview");
      setFilter("");
    };
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  useEffect(() => {
    if (!navigation.some((n) => n[0] === tab) && tab !== "notifications")
      go("overview");
  }, [tab, navigation, go]);
  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    const tasks = { notifications: "/notifications" };
    if (role === "admin")
      Object.assign(tasks, {
        stats: "/admin/stats",
        users: "/admin/users",
        hospitals: "/admin/hospitals",
        cases: "/admin/cases",
        audit: "/admin/audit-logs",
        delivery: "/admin/delivery",
      });
    else if (role === "hospital") {
      tasks.stats = `/hospitals/${uid}/stats`;
      if (verified)
        Object.assign(tasks, {
          cases: "/hospital/requests/accepted",
          documents: "/medical-records/hospital/pending",
          screening: "/match/recipients/ready",
          appointments: "/appointments",
        });
    } else {
      Object.assign(tasks, {
        hospitals: "/hospitals",
        documents: `/medical-records/${uid}`,
        appointments: `/appointments/user/${uid}`,
        cases:
          role === "donor"
            ? `/donor/${uid}/requests`
            : `/users/${uid}/requests`,
      });
      if (role === "donor") tasks.pledges = `/pledges/${uid}`;
      else tasks.recommendations = `/match-recommendations/recipient/${uid}`;
    }
    const entries = Object.entries(tasks),
      results = await Promise.allSettled(
        entries.map(([, path]) => authFetch(path, { token })),
      );
    const next = {},
      failures = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled") next[entries[i][0]] = r.value;
      else failures.push(r.reason.message);
    });
    setData(next);
    setError(
      failures.length
        ? `Some records could not be loaded: ${[...new Set(failures)].join(". ")}`
        : "",
    );
    setLoading(false);
  }, [role, uid, token, verified]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5500);
    return () => clearTimeout(timer);
  }, [toast]);
  const open = (kind, row) => {
    setFormError("");
    setDialog({ kind, row });
  };
  const close = useCallback(() => setDialog(null), []);
  async function mutate(
    path,
    body,
    method = "POST",
    message = "Changes saved",
  ) {
    setBusy(true);
    setFormError("");
    try {
      await authFetch(path, { method, body, token });
      setDialog(null);
      setToast(message);
      await refreshUser(token);
      await load();
      return true;
    } catch (err) {
      setFormError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function submit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget),
      values = Object.fromEntries(form),
      row = dialog?.row,
      kind = dialog?.kind;
    if (kind === "pledge")
      return mutate(
        `/pledges/${uid}`,
        { organ: values.organ, donationType: values.donationType },
        "POST",
        "Your pledge has been recorded",
      );
    if (kind === "hospital")
      return mutate(
        "/users/me/care-hospital",
        { hospitalId: values.hospitalId },
        "PATCH",
        "Care hospital selected",
      );
    if (kind === "upload") {
      form.delete("confirmed");
      return mutate(
        `/medical-records/${uid}/upload`,
        form,
        "POST",
        "Document submitted for review",
      );
    }
    if (kind === "review")
      return mutate(
        `/medical-records/${id(row)}/verify`,
        {
          status: values.status,
          bloodGroup: values.bloodGroup || undefined,
          reviewNotes: values.reviewNotes,
          confirmed: values.confirmed === "on",
        },
        "PATCH",
        "Document review saved",
      );
    if (kind === "schedule")
      return mutate(
        "/appointments",
        {
          allocationId: row.allocationId,
          date: values.date,
          time: values.time,
          surgeon: values.surgeon,
          durationMinutes: Number(values.durationMinutes),
          clinicalApproval: values.confirmed === "on",
        },
        "POST",
        "Appointment scheduled for both participants",
      );
    if (kind === "reschedule")
      return mutate(
        `/appointments/${id(row)}`,
        {
          date: values.date,
          time: values.time,
          surgeon: values.surgeon,
          durationMinutes: Number(values.durationMinutes),
        },
        "PATCH",
        "Appointment rescheduled",
      );
    if (kind === "withdrawCase")
      return mutate(
        `/requests/${id(row)}/withdraw`,
        { withdrawalReason: values.withdrawalReason },
        "PATCH",
        "Withdrawal recorded; linked care events closed",
      );
    if (kind === "cancel")
      return mutate(
        `/appointments/${id(row)}`,
        { status: "canceled", cancellationReason: values.cancellationReason },
        "PATCH",
        "Appointment canceled; case and pledge closed",
      );
    if (kind === "createUser")
      return mutate(
        "/admin/users",
        { ...values, consent: true },
        "POST",
        "Account created",
      );
  }
  async function confirm() {
    const { kind, row } = dialog;
    if (kind === "withdraw")
      return mutate(
        `/pledges/${uid}/${id(row)}`,
        undefined,
        "DELETE",
        "Pledge withdrawn; pending requests closed",
      );
    if (kind === "accept" || kind === "reject")
      return mutate(
        `/requests/${id(row)}/status`,
        { status: kind === "accept" ? "Accepted" : "Rejected" },
        "PATCH",
        kind === "accept"
          ? "Consent recorded. Your hospital can now review the case."
          : "Request declined",
      );
    if (kind === "request")
      return mutate(
        "/requests",
        {
          recipientId: uid,
          recommendationId: id(row),
          donorId: String(row.donorId),
          pledgeId: String(row.pledgeId),
          organ: row.organ,
          bloodGroup: row.bloodGroup,
        },
        "POST",
        "Request sent to donor",
      );
    if (kind === "decline")
      return mutate(
        `/match-recommendations/${id(row)}/status`,
        { status: "Declined" },
        "PATCH",
        "Recommendation declined",
      );
    if (kind === "allocate")
      return mutate(
        "/allocations",
        { requestId: id(row) },
        "POST",
        "Case moved to hospital review",
      );
    if (kind === "complete")
      return mutate(
        `/appointments/${id(row)}`,
        { status: "completed" },
        "PATCH",
        "Care case completed",
      );
    if (kind === "verifyHospital" || kind === "rejectHospital")
      return mutate(
        `/admin/hospitals/${id(row)}/verification`,
        { status: kind === "verifyHospital" ? "Verified" : "Rejected" },
        "PATCH",
        "Hospital verification updated",
      );
    if (kind === "suspend" || kind === "activate")
      return mutate(
        `/admin/users/${id(row)}/status`,
        { status: kind === "suspend" ? "Suspended" : "Active" },
        "PATCH",
        "Account access updated",
      );
    if (kind === "archive")
      return mutate(
        `/admin/users/${id(row)}`,
        undefined,
        "DELETE",
        "Account archived",
      );
    if (kind === "recommend")
      return mutate(
        "/match-recommendations",
        {
          recipientId: screen.recipient.id,
          donorId: row.donorId,
          pledgeId: row.pledgeId,
          organ: row.organ,
          bloodGroup: row.bloodGroup,
        },
        "POST",
        "Recommendation sent to recipient",
      );
  }
  async function runScreen(row) {
    setScreenLoading(true);
    setError("");
    try {
      setScreen(await authFetch(`/match/recipient/${id(row)}`, { token }));
    } catch (err) {
      setError(err.message);
    } finally {
      setScreenLoading(false);
    }
  }
  async function download(row) {
    try {
      await openMedicalFile(id(row), token);
    } catch (err) {
      setError(err.message);
    }
  }
  const cases = data.cases || [],
    appointments = data.appointments || [],
    documents = data.documents || [],
    pledges = data.pledges || [],
    recommendations = data.recommendations || [],
    notifications = data.notifications?.notifications || [];
  const pending =
    role === "hospital"
      ? documents.length
      : role === "admin"
        ? data.stats?.pendingHospitals || 0
        : role === "donor"
          ? cases.filter((c) => c.status === "Pending").length
          : recommendations.filter((c) => c.status === "Recommended").length;
  const upcoming = appointments
    .filter((a) => a.status === "scheduled")
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
  });
  const title =
    tab === "notifications"
      ? "Notifications"
      : navigation.find((n) => n[0] === tab)?.[1] || "Overview";
  const steps =
    role === "donor"
      ? [
          "Choose a care hospital",
          "Upload your medical evidence",
          "Create a pledge",
          "Review consent requests",
        ]
      : [
          "Choose a care hospital",
          "Upload your medical evidence",
          "Review hospital recommendations",
          "Follow your care timeline",
        ];
  const stepDone = [
    Boolean(user.careHospitalId),
    documents.some((d) => d.verificationStatus === "Verified"),
    role === "donor" ? pledges.length > 0 : recommendations.length > 0,
    cases.length > 0,
  ];
  const caseCols = [
    {
      label: "Care case",
      render: (r) => (
        <div className="care-cell-title">
          <span className="care-organ-icon">
            <HeartPulse size={17} />
          </span>
          <div>
            <strong>{r.organ}</strong>
            <small>#{String(id(r)).slice(-6).toUpperCase()}</small>
          </div>
        </div>
      ),
    },
    {
      label: role === "donor" ? "Recipient" : "Participants",
      render: (r) => (
        <div>
          <strong>{r.recipientName || name(r.recipientId)}</strong>
          <small>{r.donorName || name(r.donorId)}</small>
        </div>
      ),
    },
    { label: "Status", render: (r) => <Badge>{r.status}</Badge> },
    { label: "Opened", render: (r) => date(r.createdAt) },
    {
      label: "Next action",
      render: (r) => (
        <div className="care-actions">
          {role === "donor" && r.status === "Pending" ? (
            <>
              <Button onClick={() => open("accept", r)}>Review & accept</Button>
              <Button secondary onClick={() => open("reject", r)}>
                Decline
              </Button>
            </>
          ) : (role === "donor" || role === "recipient") &&
            ["Pending", "Accepted", "Hospital Review", "Scheduled"].includes(
              r.status,
            ) ? (
            <Button secondary onClick={() => open("withdrawCase", r)}>
              {role === "donor" ? "Withdraw consent" : "Withdraw request"}
            </Button>
          ) : role === "hospital" && r.status === "Accepted" ? (
            <Button onClick={() => open("allocate", r)}>
              Start review <ArrowRight size={14} />
            </Button>
          ) : role === "hospital" && r.status === "Hospital Review" ? (
            <Button onClick={() => open("schedule", r)}>Schedule</Button>
          ) : (
            <span className="care-muted">
              {r.status === "Completed"
                ? "Care complete"
                : r.status === "Scheduled"
                  ? "See appointments"
                  : "Awaiting next step"}
            </span>
          )}
        </div>
      ),
    },
  ];
  const apptCols = [
    {
      label: "Appointment",
      render: (r) => (
        <div>
          <strong>{r.organ} care</strong>
          <small>
            {name(r.user)}
            {r.donorId?.fullName ? ` · ${r.donorId.fullName}` : ""}
          </small>
        </div>
      ),
    },
    {
      label: "When · IST",
      render: (r) => (
        <div>
          <strong>{date(r.scheduledAt || r.date)}</strong>
          <small>
            {r.scheduledAt ? time(r.scheduledAt) : r.time}
            {r.scheduledEndAt
              ? ` – ${date(r.scheduledAt) !== date(r.scheduledEndAt) ? date(r.scheduledEndAt) + " " : ""}${time(r.scheduledEndAt)}`
              : ""}
          </small>
          <small>{r.durationMinutes || 60} minutes · IST</small>
        </div>
      ),
    },
    {
      label: "Care team",
      render: (r) => (
        <div>
          <strong>{r.surgeon}</strong>
          <small>{r.hospital || name(r.hospitalId)}</small>
        </div>
      ),
    },
    { label: "Status", render: (r) => <Badge>{r.status}</Badge> },
    {
      label: "Actions",
      render: (r) =>
        role === "hospital" && r.status === "scheduled" ? (
          <div className="care-actions">
            <Button secondary onClick={() => open("reschedule", r)}>
              Reschedule
            </Button>
            <Button secondary onClick={() => open("cancel", r)}>
              Cancel
            </Button>
            <Button
              disabled={
                !r.scheduledEndAt || new Date(r.scheduledEndAt) > new Date()
              }
              onClick={() => open("complete", r)}
            >
              Complete
            </Button>
          </div>
        ) : (
          <span className="care-muted">{r.cancellationReason || "—"}</span>
        ),
    },
  ];
  function panel(heading, subtitle, children, action) {
    return (
      <section className="care-panel">
        <div className="care-panel-heading">
          <div>
            <h2>{heading}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action}
        </div>
        {children}
      </section>
    );
  }
  const mainAction =
    role === "admin" ? (
      <Button onClick={() => open("createUser")}>
        <Plus size={16} />
        Create account
      </Button>
    ) : role === "hospital" ? (
      <Button disabled={!verified} onClick={() => go("documents")}>
        Review documents <ArrowRight size={16} />
      </Button>
    ) : role === "donor" ? (
      <Button onClick={() => open("pledge")}>
        <Plus size={16} />
        New pledge
      </Button>
    ) : (
      <Button onClick={() => go("recommendations")}>
        View recommendations <ArrowRight size={16} />
      </Button>
    );
  const confirmTitles = {
    withdraw: "Withdraw this pledge?",
    accept: "Record your donor consent?",
    reject: "Decline this request?",
    request: "Request donor consent?",
    decline: "Decline this recommendation?",
    allocate: "Begin hospital review?",
    complete: "Complete this care case?",
    verifyHospital: "Verify this hospital?",
    rejectHospital: "Reject hospital verification?",
    suspend: "Suspend account access?",
    activate: "Restore account access?",
    archive: "Archive this account?",
    recommend: "Send this recommendation?",
  };
  const confirmMessages = {
    accept:
      "Your decision reserves this pledge for this case. Competing pending requests will close. Clinical eligibility and final approvals remain your hospital’s responsibility.",
    request:
      "This is a request for donor consent following basic screening. It does not confirm clinical suitability or final allocation.",
    complete:
      "Confirm the care event has actually finished. This closes the appointment, allocation, request, and pledge together.",
    verifyHospital:
      "Confirm the licence and organization credentials have been checked outside this app before granting clinical access.",
    recommend:
      "Only basic screening evidence is available. The recipient will see that further clinical evidence and final approvals are required.",
    archive:
      "The account will be suspended and retained for record history. Active cases must be resolved first.",
    withdraw:
      "Your pledge will be retained as withdrawn, and pending requests will be canceled.",
  };
  return (
    <div className="care-app">
      <a className="care-skip" href="#care-main">
        Skip to content
      </a>
      {mobile && (
        <button
          className="care-nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`care-sidebar ${mobile ? "is-open" : ""}`}>
        <a
          href="#overview"
          className="care-brand"
          onClick={() => go("overview")}
        >
          <span>
            <HeartPulse size={24} />
          </span>
          <div>
            organ<span>sync</span>
            <small>CONNECTED BY CARE</small>
          </div>
        </a>
        <div className="care-workspace-label">
          YOUR WORKSPACE <Badge>{role}</Badge>
        </div>
        <nav aria-label="Workspace navigation">
          {navigation.map(([key, label, Icon]) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              aria-current={tab === key ? "page" : undefined}
              onClick={() => go(key)}
            >
              <Icon size={19} />
              {label}
              {key === "documents" && role === "hospital" && pending > 0 && (
                <span className="care-nav-count">{pending}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="care-sidebar-bottom">
          <div className="care-trust">
            <ShieldCheck size={21} />
            <strong>Every step, accountable.</strong>
            <p>Evidence. Consent. Coordinated care.</p>
          </div>
          <button className="care-profile" onClick={() => go("settings")}>
            <span className="care-avatar">
              {user.fullName
                ?.split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <strong>{user.fullName}</strong>
              <small>{role} workspace</small>
            </div>
            <ChevronRight size={16} />
          </button>
          <button className="care-signout" onClick={logout}>
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>
      <div className="care-main-wrap">
        <header className="care-topbar">
          <div>
            <button
              className="care-icon care-menu"
              aria-label="Open navigation"
              aria-expanded={mobile}
              onClick={() => setMobile(true)}
            >
              <Menu size={22} />
            </button>
            <span className="care-breadcrumb">
              Workspace <ChevronRight size={13} /> <strong>{title}</strong>
            </span>
          </div>
          <div>
            <span className="care-date">{today}</span>
            <button
              className={`care-icon ${tab === "notifications" ? "selected" : ""}`}
              aria-label="Open notifications"
              onClick={() => go("notifications")}
            >
              <Bell size={19} />
              {notifications.some((n) => !n.isRead) && (
                <i className="care-unread-dot" />
              )}
            </button>
            <span className="care-top-avatar">{user.fullName?.[0]}</span>
          </div>
        </header>
        <main id="care-main" className="care-content">
          <div className="care-page-heading">
            <div>
              <span className="care-eyebrow">
                {role === "hospital"
                  ? "CARE COORDINATION"
                  : role === "admin"
                    ? "NETWORK OPERATIONS"
                    : "YOUR CARE, CONNECTED"}
              </span>
              <h1>
                {tab === "overview"
                  ? `Welcome${role === "admin" ? " back" : ""}, ${user.fullName?.split(" ")[0]}.`
                  : title}
              </h1>
              <p>
                {tab === "overview"
                  ? "A clear view of what matters. A confident next step."
                  : "One workspace for the details that move care forward."}
              </p>
            </div>
            <div className="care-heading-actions">
              <Button
                secondary
                onClick={load}
                disabled={loading}
                aria-label="Refresh workspace"
              >
                <RefreshCw size={16} />
                <span>Refresh</span>
              </Button>
              {mainAction}
            </div>
          </div>
          {!verified && (
            <div className="care-notice">
              <ShieldCheck size={22} />
              <div>
                <strong>Hospital verification is pending</strong>
                <p>
                  Your account is registered. An administrator must verify your
                  licence before you can access patient evidence or clinical
                  actions.
                </p>
              </div>
              <Button
                secondary
                onClick={async () => {
                  await refreshUser(token);
                  await load();
                }}
              >
                Check status
              </Button>
            </div>
          )}
          {error && (
            <div className="care-error" role="alert">
              {error}
              <Button secondary onClick={load}>
                Try again
              </Button>
            </div>
          )}
          {loading ? (
            <Skeleton />
          ) : (
            <>
              {tab === "overview" && (
                <>
                  <div className="care-stats">
                    <StatCard
                      label={
                        role === "admin"
                          ? "People in the network"
                          : role === "hospital"
                            ? "Active donor pledges"
                            : role === "donor"
                              ? "Your pledges"
                              : "Your care cases"
                      }
                      value={
                        role === "admin"
                          ? data.stats?.totalUsers
                          : role === "hospital"
                            ? data.stats?.activeDonorOrgans
                            : role === "donor"
                              ? pledges.filter(
                                  (p) => p.status === "Active & Pledged",
                                ).length
                              : cases.length
                      }
                      detail={
                        role === "hospital"
                          ? "Assigned hospital network"
                          : "Connected through OrganSync"
                      }
                      icon={HeartPulse}
                      accent
                    />
                    <StatCard
                      label="Needs your attention"
                      value={pending}
                      detail={
                        role === "hospital"
                          ? "Documents awaiting review"
                          : role === "admin"
                            ? "Hospitals awaiting verification"
                            : "Decisions awaiting you"
                      }
                      icon={ClipboardCheck}
                    />
                    <StatCard
                      label={
                        role === "admin"
                          ? "Partner hospitals"
                          : "Upcoming appointments"
                      }
                      value={
                        role === "admin"
                          ? data.stats?.hospitals
                          : upcoming.length
                      }
                      detail={
                        role === "admin"
                          ? "Registered organizations"
                          : "Scheduled care events"
                      }
                      icon={CalendarDays}
                    />
                    <StatCard
                      label={
                        role === "admin"
                          ? "Active pledges"
                          : role === "hospital"
                            ? "Completed this month"
                            : "Verified documents"
                      }
                      value={
                        role === "admin"
                          ? data.stats?.activePledges
                          : role === "hospital"
                            ? data.stats?.transplantsThisMonth
                            : documents.filter(
                                (d) => d.verificationStatus === "Verified",
                              ).length
                      }
                      detail={
                        role === "hospital"
                          ? "Recorded completed allocations"
                          : "Evidence makes progress possible"
                      }
                      icon={ShieldCheck}
                    />
                  </div>
                  <div className="care-overview-grid">
                    <section className="care-hero">
                      <div>
                        <span className="care-eyebrow">
                          {role === "hospital"
                            ? "THE NEXT STEP STARTS HERE"
                            : role === "admin"
                              ? "A STRONGER CARE NETWORK"
                              : "SMALL STEPS. MEANINGFUL PROGRESS."}
                        </span>
                        <h2>
                          {role === "hospital"
                            ? "Less friction.\nMore coordinated care."
                            : role === "admin"
                              ? "Trust is built\none decision at a time."
                              : "Your next step\ncould change a life."}
                        </h2>
                        <p>
                          {role === "hospital"
                            ? "Bring evidence, decisions, and care teams together in one accountable workflow."
                            : role === "admin"
                              ? "Verify organizations, manage access, and follow the decisions behind every care journey."
                              : "Keep your documents up to date and stay connected with your care team at every stage."}
                        </p>
                        <Button
                          onClick={() =>
                            go(
                              role === "hospital"
                                ? "documents"
                                : role === "admin"
                                  ? "hospitals"
                                  : !user.careHospitalId
                                    ? "settings"
                                    : "documents",
                            )
                          }
                        >
                          {role === "admin"
                            ? "Review hospitals"
                            : role === "hospital"
                              ? "Open review queue"
                              : "Continue your journey"}
                          <ArrowUpRight size={17} />
                        </Button>
                      </div>
                      <CareEmblem />
                    </section>
                    {panel(
                      role === "admin"
                        ? "Network at a glance"
                        : role === "hospital"
                          ? "Today’s focus"
                          : "Your next steps",
                      role === "admin"
                        ? "A shared foundation for coordinated care"
                        : "Progress starts with one clear action",
                      role === "admin" ? (
                        <div className="care-focus-list">
                          {[
                            ["Donors", data.stats?.donors],
                            ["Recipients", data.stats?.recipients],
                            ["Pending requests", data.stats?.pendingRequests],
                            ["Accepted cases", data.stats?.acceptedCases],
                          ].map(([k, v]) => (
                            <div key={k}>
                              <span>{k}</span>
                              <strong>{v ?? 0}</strong>
                            </div>
                          ))}
                        </div>
                      ) : role === "hospital" ? (
                        <div className="care-focus-list">
                          {[
                            [
                              "Documents to review",
                              documents.length,
                              "documents",
                            ],
                            [
                              "Recipients ready for screening",
                              data.screening?.length || 0,
                              "screening",
                            ],
                            [
                              "Cases in hospital review",
                              cases.filter(
                                (c) => c.status === "Hospital Review",
                              ).length,
                              "cases",
                            ],
                            [
                              "Appointments scheduled",
                              upcoming.length,
                              "appointments",
                            ],
                          ].map(([k, v, key]) => (
                            <button key={k} onClick={() => go(key)}>
                              <span>{k}</span>
                              <strong>
                                {v}
                                <ChevronRight size={15} />
                              </strong>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <ol className="care-checklist">
                          {steps.map((s, i) => (
                            <li key={s} className={stepDone[i] ? "done" : ""}>
                              <span>
                                {stepDone[i] ? <Check size={14} /> : i + 1}
                              </span>
                              <button
                                onClick={() =>
                                  go(
                                    i === 0
                                      ? "settings"
                                      : i === 1
                                        ? "documents"
                                        : i === 2
                                          ? role === "donor"
                                            ? "pledges"
                                            : "recommendations"
                                          : "cases",
                                  )
                                }
                              >
                                {s}
                              </button>
                              {stepDone[i] && <small>Done</small>}
                            </li>
                          ))}
                        </ol>
                      ),
                    )}
                  </div>
                  <div className="care-overview-grid lower">
                    {panel(
                      role === "admin" ? "Recent care cases" : "Care in motion",
                      "Follow the latest case activity",
                      cases.length ? (
                        <div className="care-case-previews">
                          {cases.slice(0, 3).map((r) => (
                            <article key={id(r)}>
                              <div className="care-case-top">
                                <div>
                                  <strong>{r.organ} care journey</strong>
                                  <small>
                                    {r.recipientName || name(r.recipientId)} · #
                                    {String(id(r)).slice(-6)}
                                  </small>
                                </div>
                                <Badge>{r.status}</Badge>
                              </div>
                              <Timeline row={r} />
                            </article>
                          ))}
                        </div>
                      ) : (
                        <EmptyState
                          title="Your care timeline starts here"
                          message={
                            role === "hospital"
                              ? "Donor-approved cases will appear when they’re ready for your review."
                              : "Your case will appear as your care journey progresses."
                          }
                        />
                      ),
                      <button
                        className="care-text-button"
                        onClick={() => go("cases")}
                      >
                        View all <ArrowRight size={14} />
                      </button>,
                    )}
                    {panel(
                      "Coming up",
                      "Your next scheduled care event",
                      upcoming.length ? (
                        <div className="care-upcoming">
                          <span className="care-upcoming-icon">
                            <CalendarDays size={27} />
                          </span>
                          <span className="care-eyebrow">
                            {date(upcoming[0].scheduledAt)}
                          </span>
                          <h3>{upcoming[0].organ} care appointment</h3>
                          <p>
                            {upcoming[0].surgeon} ·{" "}
                            {time(upcoming[0].scheduledAt)} IST
                          </p>
                          <Badge>{upcoming[0].status}</Badge>
                          <Button secondary onClick={() => go("appointments")}>
                            View appointment <ArrowRight size={15} />
                          </Button>
                        </div>
                      ) : (
                        <EmptyState
                          title="A little breathing room"
                          message="Your upcoming appointments will appear here once scheduled."
                        />
                      ),
                    )}
                  </div>
                </>
              )}
              {tab === "cases" &&
                panel(
                  "Care case register",
                  "Track consent, review, scheduling, and completion.",
                  <>
                    <DataTable
                      rows={cases}
                      columns={caseCols}
                      filter={filter}
                    />
                    {(role === "donor" || role === "recipient") &&
                      cases.map((r) => (
                        <div className="care-case-detail" key={id(r)}>
                          <strong>
                            {r.organ} · #{String(id(r)).slice(-6)}
                          </strong>
                          <Timeline row={r} />
                        </div>
                      ))}
                  </>,
                )}
              {tab === "pledges" &&
                panel(
                  "Your pledge, your decision",
                  "Pledges remain subject to eligibility, consent, and clinical review.",
                  <DataTable
                    rows={pledges}
                    filter={filter}
                    columns={[
                      {
                        label: "Organ",
                        render: (r) => <strong>{r.organ}</strong>,
                      },
                      {
                        label: "Donation intent",
                        render: (r) => r.donationType || "Review required",
                      },
                      {
                        label: "Pledged",
                        render: (r) => r.pledgeDate || date(r.createdAt),
                      },
                      {
                        label: "Status",
                        render: (r) => <Badge>{r.status}</Badge>,
                      },
                      {
                        label: "Actions",
                        render: (r) =>
                          r.status === "Active & Pledged" ? (
                            <Button
                              secondary
                              onClick={() => open("withdraw", r)}
                            >
                              Withdraw pledge
                            </Button>
                          ) : (
                            <span className="care-muted">
                              Retained in your history
                            </span>
                          ),
                      },
                    ]}
                  />,
                  <Button onClick={() => open("pledge")}>
                    <Plus size={16} />
                    Add pledge
                  </Button>,
                )}
              {tab === "recommendations" && (
                <>
                  <div className="care-notice">
                    <ShieldCheck size={22} />
                    <div>
                      <strong>Evidence first. Decisions together.</strong>
                      <p>
                        Recommendations reflect basic screening only. Further
                        clinical evidence, donor consent, and final approvals
                        are required.
                      </p>
                    </div>
                  </div>
                  {recommendations.length ? (
                    <div className="care-recommendations">
                      {recommendations
                        .filter((r) =>
                          JSON.stringify(r)
                            .toLowerCase()
                            .includes(filter.toLowerCase()),
                        )
                        .map((r) => (
                          <article className="care-panel" key={id(r)}>
                            <div className="care-case-top">
                              <span className="care-organ-icon">
                                <HeartPulse size={23} />
                              </span>
                              <Badge>{r.status}</Badge>
                            </div>
                            <h2>{r.organ} screening recommendation</h2>
                            <p>From {r.hospitalName}</p>
                            <div className="care-match-facts">
                              <div>
                                <small>Verified blood group</small>
                                <strong>{r.bloodGroup}</strong>
                              </div>
                              <div>
                                <small>Screening status</small>
                                <strong>Clinical review required</strong>
                              </div>
                            </div>
                            <h4>Evidence still needed</h4>
                            <ul>
                              {r.missingEvidence?.map((x) => (
                                <li key={x}>{x}</li>
                              ))}
                            </ul>
                            {r.status === "Recommended" && (
                              <div className="care-actions">
                                <Button onClick={() => open("request", r)}>
                                  Request donor consent <ArrowRight size={15} />
                                </Button>
                                <Button
                                  secondary
                                  onClick={() => open("decline", r)}
                                >
                                  Decline
                                </Button>
                              </div>
                            )}
                          </article>
                        ))}
                    </div>
                  ) : (
                    panel(
                      "Recommendations",
                      "Prepared by your verified care hospital",
                      <EmptyState
                        title="Your care team is reviewing the evidence"
                        message="Choose a hospital and submit your documents to get started."
                      />,
                    )
                  )}
                </>
              )}
              {tab === "documents" &&
                panel(
                  role === "hospital"
                    ? "Evidence review queue"
                    : "Your medical evidence",
                  role === "hospital"
                    ? "Review original documents before recording your decision."
                    : "Private to you and your assigned verified care hospital.",
                  <DataTable
                    rows={documents}
                    filter={filter}
                    columns={[
                      {
                        label: "Document",
                        render: (r) => (
                          <div className="care-cell-title">
                            <FileText size={20} />
                            <div>
                              <strong>{r.documentType}</strong>
                              <small>{r.fileName || r.originalFileName}</small>
                            </div>
                          </div>
                        ),
                      },
                      ...(role === "hospital"
                        ? [
                            {
                              label: "Patient",
                              render: (r) => r.patient?.fullName || "—",
                            },
                          ]
                        : []),
                      { label: "Submitted", render: (r) => date(r.createdAt) },
                      {
                        label: "Review",
                        render: (r) => <Badge>{r.verificationStatus}</Badge>,
                      },
                      {
                        label: "Extraction",
                        render: (r) => <Badge>{r.extractionStatus}</Badge>,
                      },
                      {
                        label: "Actions",
                        render: (r) => (
                          <div className="care-actions">
                            <Button secondary onClick={() => download(r)}>
                              Download
                            </Button>
                            {role === "hospital" && (
                              <Button onClick={() => open("review", r)}>
                                Review evidence
                              </Button>
                            )}
                          </div>
                        ),
                      },
                    ]}
                  />,
                  role !== "hospital" && (
                    <Button
                      onClick={() => open("upload")}
                      disabled={!user.careHospitalId}
                    >
                      <Plus size={16} />
                      Upload document
                    </Button>
                  ),
                )}
              {tab === "screening" && (
                <>
                  {panel(
                    "Screening workspace",
                    "Only assigned recipients with verified blood-group evidence appear here.",
                    <DataTable
                      rows={data.screening || []}
                      filter={filter}
                      columns={[
                        {
                          label: "Recipient",
                          render: (r) => <strong>{r.fullName}</strong>,
                        },
                        { label: "Organ", render: (r) => r.organ },
                        {
                          label: "Verified blood group",
                          render: (r) => r.verifiedBloodGroup,
                        },
                        {
                          label: "Actions",
                          render: (r) => (
                            <Button
                              disabled={screenLoading}
                              onClick={() => runScreen(r)}
                            >
                              Run basic screening <ArrowRight size={14} />
                            </Button>
                          ),
                        },
                      ]}
                    />,
                  )}
                  {screenLoading ? (
                    <Skeleton />
                  ) : (
                    screen &&
                    panel(
                      `Screening for ${screen.recipient?.name || "recipient"}`,
                      "Basic screening is not a clinical compatibility determination.",
                      screen.matches?.length ? (
                        <DataTable
                          rows={screen.matches}
                          rowKey={(r) => r.pledgeId}
                          columns={[
                            { label: "Donor", render: (r) => r.donorName },
                            { label: "Organ", render: (r) => r.organ },
                            {
                              label: "Verified blood group",
                              render: (r) => r.bloodGroup,
                            },
                            {
                              label: "Evidence needed",
                              render: (r) => r.missingEvidence.join(", "),
                            },
                            {
                              label: "Action",
                              render: (r) => (
                                <Button onClick={() => open("recommend", r)}>
                                  Recommend
                                </Button>
                              ),
                            },
                          ]}
                        />
                      ) : (
                        <EmptyState
                          title="No candidates meet basic screening criteria"
                          message={
                            screen.reason ||
                            "Additional verified evidence or active pledges may be needed."
                          }
                        />
                      ),
                    )
                  )}
                </>
              )}
              {tab === "appointments" &&
                panel(
                  "Coordinated appointments",
                  "All dates and times are shown in India Standard Time (IST).",
                  <DataTable
                    rows={appointments}
                    columns={apptCols}
                    filter={filter}
                  />,
                )}
              {tab === "users" &&
                panel(
                  "People & access",
                  "Manage accounts while preserving care history.",
                  <DataTable
                    rows={data.users || []}
                    filter={filter}
                    columns={[
                      {
                        label: "Person",
                        render: (r) => (
                          <div>
                            <strong>{r.fullName}</strong>
                            <small>{r.email}</small>
                          </div>
                        ),
                      },
                      { label: "Role", render: (r) => <Badge>{r.role}</Badge> },
                      {
                        label: "Access",
                        render: (r) => (
                          <Badge>
                            {r.deletedAt ? "Archived" : r.accountStatus}
                          </Badge>
                        ),
                      },
                      { label: "Joined", render: (r) => date(r.createdAt) },
                      {
                        label: "Actions",
                        render: (r) =>
                          r.role !== "admin" && !r.deletedAt ? (
                            <div className="care-actions">
                              <Button
                                secondary
                                onClick={() =>
                                  open(
                                    r.accountStatus === "Active"
                                      ? "suspend"
                                      : "activate",
                                    r,
                                  )
                                }
                              >
                                {r.accountStatus === "Active"
                                  ? "Suspend"
                                  : "Activate"}
                              </Button>
                              <Button
                                secondary
                                onClick={() => open("archive", r)}
                              >
                                Archive
                              </Button>
                            </div>
                          ) : (
                            "—"
                          ),
                      },
                    ]}
                  />,
                  <Button onClick={() => open("createUser")}>
                    <Plus size={16} />
                    Create account
                  </Button>,
                )}
              {tab === "hospitals" &&
                panel(
                  "Hospital verification",
                  "Check organization credentials and licence before enabling clinical access.",
                  <DataTable
                    rows={data.hospitals || []}
                    filter={filter}
                    columns={[
                      {
                        label: "Hospital",
                        render: (r) => <strong>{r.fullName || r.name}</strong>,
                      },
                      {
                        label: "Licence",
                        render: (r) => r.license || "Not provided",
                      },
                      {
                        label: "Verification",
                        render: (r) => (
                          <Badge>{r.verificationState || r.state}</Badge>
                        ),
                      },
                      {
                        label: "Actions",
                        render: (r) => (
                          <div className="care-actions">
                            <Button
                              disabled={
                                !r.license ||
                                (r.verificationState || r.state) === "Verified"
                              }
                              onClick={() => open("verifyHospital", r)}
                            >
                              Verify credentials
                            </Button>
                            <Button
                              secondary
                              onClick={() => open("rejectHospital", r)}
                            >
                              Reject
                            </Button>
                          </div>
                        ),
                      },
                    ]}
                  />,
                )}
              {tab === "delivery" &&
                panel(
                  "Email delivery",
                  "Durable workflow notifications with automatic retries. Password reset emails are sent separately.",
                  <DataTable
                    rows={data.delivery || []}
                    filter={filter}
                    columns={[
                      { label: "Queued", render: (r) => date(r.createdAt) },
                      {
                        label: "Status",
                        render: (r) => <Badge>{r.status}</Badge>,
                      },
                      { label: "Attempts", render: (r) => r.attempts },
                      {
                        label: "Next attempt",
                        render: (r) =>
                          r.status === "Pending" ? date(r.nextAttemptAt) : "—",
                      },
                      {
                        label: "Actions",
                        render: (r) =>
                          r.status === "Failed" ? (
                            <Button
                              secondary
                              disabled={busy}
                              onClick={() =>
                                mutate(
                                  `/admin/delivery/${id(r)}/retry`,
                                  {},
                                  "POST",
                                  "Delivery retry queued",
                                )
                              }
                            >
                              Retry delivery
                            </Button>
                          ) : (
                            "—"
                          ),
                      },
                    ]}
                  />,
                )}
              {tab === "audit" &&
                panel(
                  "Accountable by design",
                  "A chronological record of system decisions and access events.",
                  <DataTable
                    rows={data.audit || []}
                    filter={filter}
                    columns={[
                      {
                        label: "Event",
                        render: (r) => (
                          <div>
                            <strong>{r.action?.replaceAll("_", " ")}</strong>
                            <small>{r.message}</small>
                          </div>
                        ),
                      },
                      {
                        label: "Actor",
                        render: (r) => r.actorName || r.actorRole,
                      },
                      { label: "Record", render: (r) => r.entityType },
                      {
                        label: "Recorded · IST",
                        render: (r) => (
                          <div>
                            {date(r.createdAt)}
                            <small>{time(r.createdAt)}</small>
                          </div>
                        ),
                      },
                    ]}
                  />,
                )}
              {tab === "notifications" &&
                panel(
                  "Your updates",
                  "Decisions and appointments, all in one place.",
                  notifications.length ? (
                    <div className="care-notifications">
                      {notifications.map((n) => (
                        <article
                          key={id(n)}
                          className={n.isRead ? "" : "unread"}
                        >
                          <span className="care-organ-icon">
                            <Bell size={18} />
                          </span>
                          <div>
                            <strong>{n.title}</strong>
                            <p>{n.message}</p>
                            <small>
                              {date(n.createdAt)} · {time(n.createdAt)} IST
                            </small>
                          </div>
                          {!n.isRead && (
                            <Button
                              secondary
                              onClick={() =>
                                mutate(
                                  `/notifications/${id(n)}/read`,
                                  undefined,
                                  "PATCH",
                                  "Notification marked as read",
                                )
                              }
                            >
                              Mark read
                            </Button>
                          )}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="You’re all caught up"
                      message="New care updates will appear here."
                    />
                  ),
                )}
              {tab === "settings" && (
                <div className="care-settings-grid">
                  {panel(
                    "Your account",
                    "Account information and current access.",
                    <dl className="care-profile-details">
                      {[
                        ["Full name", user.fullName],
                        ["Email", user.email],
                        ["Role", role],
                        ["Phone", user.phone],
                        ["Account status", user.accountStatus],
                        ...(role === "hospital"
                          ? [
                              ["Hospital licence", user.license],
                              ["Verification", user.verificationState],
                            ]
                          : []),
                      ].map(([k, v]) => (
                        <div key={k}>
                          <dt>{k}</dt>
                          <dd>{v || "—"}</dd>
                        </div>
                      ))}
                    </dl>,
                  )}
                  {role !== "admin" &&
                    role !== "hospital" &&
                    panel(
                      "Your care hospital",
                      "Your documents and screening are shared only with this verified hospital.",
                      <>
                        <span className="care-organ-icon">
                          <Building2 size={27} />
                        </span>
                        <h3>
                          {data.hospitals?.find(
                            (h) =>
                              String(id(h)) === String(user.careHospitalId),
                          )?.name || "Choose your care hospital"}
                        </h3>
                        <p>
                          Select the hospital coordinating your care before
                          uploading evidence. Contact your coordinator if you
                          need a transfer after submitting documents.
                        </p>
                        <Button onClick={() => open("hospital")}>
                          {user.careHospitalId
                            ? "Review hospital selection"
                            : "Choose a hospital"}
                          <ArrowRight size={16} />
                        </Button>
                      </>,
                    )}
                </div>
              )}
            </>
          )}
          <footer className="care-footer">
            <span>
              <HeartPulse size={15} /> Connected by care. Guided by evidence.
            </span>
            <span>OrganSync · {role} workspace</span>
          </footer>
        </main>
      </div>
      {tab !== "overview" && tab !== "settings" && tab !== "notifications" && (
        <div className="care-search-dock">
          <Search size={17} />
          <input
            type="search"
            aria-label={`Search ${title.toLowerCase()}`}
            placeholder={`Search ${title.toLowerCase()}…`}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {filter && (
            <button
              aria-label="Clear search"
              className="care-icon"
              onClick={() => setFilter("")}
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}
      <Toast message={toast} onClose={() => setToast("")} />
      {dialog && confirmTitles[dialog.kind] ? (
        <ConfirmDialog
          title={confirmTitles[dialog.kind]}
          message={
            confirmMessages[dialog.kind] ||
            "This decision will be recorded in the workspace. Confirm to continue."
          }
          onClose={close}
          onConfirm={confirm}
          busy={busy}
          error={formError}
        />
      ) : (
        dialog && (
          <Modal
            title={
              {
                pledge: "Create a new pledge",
                hospital: "Choose your care hospital",
                upload: "Submit medical evidence",
                review: "Review original evidence",
                schedule: "Schedule a care appointment",
                reschedule: "Reschedule appointment",
                cancel: "Cancel appointment",
                withdrawCase: "Withdraw from this care case",
                createUser: "Create a network account",
              }[dialog.kind]
            }
            onClose={close}
            busy={busy}
          >
            <form onSubmit={submit}>
              {dialog.kind === "pledge" && (
                <>
                  <p>
                    A pledge expresses your intent. Clinical eligibility,
                    informed consent, and hospital approval are separate steps.
                  </p>
                  <Field label="Donation intent">
                    <Select
                      name="donationType"
                      options={["Living", "Deceased pledge"]}
                      required
                    />
                  </Field>
                  <Field label="Organ">
                    <Select name="organ" options={organs} required />
                  </Field>
                  <p className="care-muted">
                    Living donation screening is limited to kidney or partial
                    liver. A deceased-donation pledge records future intent and
                    is never treated as an available organ in this workflow.
                  </p>
                </>
              )}
              {dialog.kind === "hospital" && (
                <>
                  <p>
                    Only this verified hospital will receive your medical
                    evidence.
                  </p>
                  <Field label="Verified care hospital">
                    <Select
                      name="hospitalId"
                      defaultValue={user.careHospitalId || ""}
                      options={[
                        ["", "Select a verified hospital"],
                        ...(data.hospitals || []).map((h) => [id(h), h.name]),
                      ]}
                      required
                    />
                  </Field>
                </>
              )}
              {dialog.kind === "upload" && (
                <>
                  <p>
                    Upload a PDF, JPEG, or PNG up to 10 MB. Images and scanned
                    reports may require manual review.
                  </p>
                  <Field label="Document type">
                    <Select
                      name="documentType"
                      options={[
                        "Blood Group Report",
                        "HLA Typing Report",
                        "Crossmatch Report",
                        "Medical Summary",
                        "Other",
                      ]}
                      required
                    />
                  </Field>
                  <Field label="Medical document">
                    <input
                      name="file"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      required
                    />
                  </Field>
                  <div className="care-form-grid">
                    <Field label="Laboratory (optional)">
                      <input name="laboratory" maxLength={200} />
                    </Field>
                    <Field label="Report date (optional)">
                      <input
                        type="date"
                        name="reportDate"
                        max={new Date().toLocaleDateString("en-CA", {
                          timeZone: "Asia/Kolkata",
                        })}
                      />
                    </Field>
                  </div>
                </>
              )}
              {dialog.kind === "review" && (
                <>
                  <p>
                    <strong>{dialog.row.patient?.fullName}</strong> ·{" "}
                    {dialog.row.documentType}
                  </p>
                  <Button secondary onClick={() => download(dialog.row)}>
                    <FileText size={16} />
                    Download original evidence
                  </Button>
                  <Field label="Review decision">
                    <Select name="status" options={["Verified", "Rejected"]} />
                  </Field>
                  <Field label="Blood group confirmed from original">
                    <Select
                      name="bloodGroup"
                      defaultValue={dialog.row.extractedData?.bloodGroup || ""}
                      options={[
                        ["", "Not applicable / not established"],
                        ...bloods,
                      ]}
                    />
                  </Field>
                  <Field label="Review notes">
                    <textarea
                      name="reviewNotes"
                      required
                      maxLength={2000}
                      rows={3}
                      placeholder="Record what you checked and any concerns."
                    />
                  </Field>
                  <label className="care-checkbox">
                    <input name="confirmed" type="checkbox" />
                    <span>
                      I reviewed the original evidence. Any values recorded
                      reflect the document, not an unverified profile.
                    </span>
                  </label>
                </>
              )}
              {(dialog.kind === "schedule" || dialog.kind === "reschedule") && (
                <>
                  <p>
                    Times are in India Standard Time. Both donor and recipient
                    will see this appointment.
                  </p>
                  <div className="care-form-grid">
                    <Field label="Appointment date">
                      <input
                        type="date"
                        name="date"
                        min={new Date().toLocaleDateString("en-CA", {
                          timeZone: "Asia/Kolkata",
                        })}
                        defaultValue={
                          dialog.row.scheduledAt
                            ? new Date(
                                dialog.row.scheduledAt,
                              ).toLocaleDateString("en-CA", {
                                timeZone: "Asia/Kolkata",
                              })
                            : ""
                        }
                        required
                      />
                    </Field>
                    <Field label="Appointment time · IST">
                      <input
                        type="time"
                        name="time"
                        defaultValue={dialog.row.time || ""}
                        required
                      />
                    </Field>
                  </div>
                  <Field label="Duration (minutes)">
                    <Select
                      name="durationMinutes"
                      defaultValue={String(dialog.row.durationMinutes || 60)}
                      options={Array.from({ length: 32 }, (_, i) => [
                        String((i + 1) * 15),
                        `${(i + 1) * 15} minutes`,
                      ])}
                      required
                    />
                  </Field>
                  <p className="care-muted">
                    The clinician, donor, and recipient must be free for the
                    full appointment. Adjacent appointments are allowed.
                  </p>
                  <Field label="Responsible clinician">
                    <input
                      name="surgeon"
                      defaultValue={dialog.row.surgeon || ""}
                      minLength={3}
                      maxLength={120}
                      required
                    />
                  </Field>
                  {dialog.kind === "schedule" && (
                    <label className="care-checkbox">
                      <input name="confirmed" type="checkbox" required />
                      <span>
                        I confirm that the responsible clinical team has checked
                        the required eligibility, consent, and approvals before
                        scheduling.
                      </span>
                    </label>
                  )}
                </>
              )}
              {dialog.kind === "withdrawCase" && (
                <>
                  <p>
                    You may withdraw from an active case. Your hospital and the
                    other participant will be notified, and linked appointments
                    will close.
                  </p>
                  <Field label="Withdrawal reason">
                    <textarea
                      name="withdrawalReason"
                      maxLength={1000}
                      rows={3}
                      required
                    />
                  </Field>
                </>
              )}
              {dialog.kind === "cancel" && (
                <>
                  <p>
                    Canceling closes this case and withdraws the reserved
                    pledge. A new clinical review is required before any future
                    case.
                  </p>
                  <Field label="Cancellation reason">
                    <textarea
                      name="cancellationReason"
                      required
                      maxLength={1000}
                      rows={3}
                    />
                  </Field>
                </>
              )}
              {dialog.kind === "createUser" && (
                <>
                  <div className="care-form-grid">
                    <Field label="Role">
                      <Select
                        name="role"
                        options={["donor", "recipient", "hospital"]}
                      />
                    </Field>
                    <Field label="Full name">
                      <input name="fullName" required maxLength={120} />
                    </Field>
                    <Field label="Email address">
                      <input name="email" type="email" required />
                    </Field>
                    <Field label="Indian mobile number">
                      <input
                        name="phone"
                        inputMode="tel"
                        pattern="[6-9][0-9]{9}"
                        required
                      />
                    </Field>
                    <Field label="Blood group (patients)">
                      <Select name="bloodGroup" options={bloods} />
                    </Field>
                    <Field label="Organ (patients)">
                      <Select name="organ" options={organs} />
                    </Field>
                  </div>
                  <Field label="Hospital licence (hospital accounts)">
                    <input name="license" maxLength={150} />
                  </Field>
                  <Field label="Initial password">
                    <input
                      name="password"
                      type="password"
                      minLength={8}
                      maxLength={72}
                      autoComplete="new-password"
                      required
                    />
                  </Field>
                  <p className="care-muted">
                    Include uppercase, lowercase, number and symbol. Obtain the
                    person’s consent before creating their account.
                  </p>
                </>
              )}
              {formError && (
                <div className="care-error" role="alert">
                  {formError}
                </div>
              )}
              <div className="care-form-actions">
                <Button secondary disabled={busy} onClick={close}>
                  Go back
                </Button>
                <Button type="submit" busy={busy}>
                  {dialog.kind === "review" ? "Save review" : "Save & continue"}
                  <ArrowRight size={15} />
                </Button>
              </div>
            </form>
          </Modal>
        )
      )}
    </div>
  );
}
