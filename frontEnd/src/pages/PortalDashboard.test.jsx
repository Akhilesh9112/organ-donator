import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, beforeEach, test, expect } from "vitest";
import PortalDashboard from "./PortalDashboard";
import ResetPasswordPage from "./ResetPasswordPage";
const mock = vi.hoisted(() => ({
  user: null,
  fetch: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn(),
}));
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: mock.user,
    refreshUser: mock.refresh,
    logout: mock.logout,
  }),
}));
vi.mock("../config/api", () => ({
  authFetch: (...args) => mock.fetch(...args),
  openMedicalFile: vi.fn(),
}));
const uid = "aaaaaaaaaaaaaaaaaaaaaaaa";
beforeEach(() => {
  mock.fetch.mockReset();
  mock.refresh.mockResolvedValue({});
  mock.user = {
    userId: uid,
    fullName: "Test Person",
    role: "donor",
    token: "test-token",
    careHospitalId: "bbbbbbbbbbbbbbbbbbbbbbbb",
    verificationState: "Verified",
    accountStatus: "Active",
  };
  mock.fetch.mockImplementation(async (path) =>
    path === "/notifications"
      ? { notifications: [] }
      : path.includes("stats")
        ? { totalUsers: 5 }
        : [],
  );
});
for (const role of ["donor", "recipient", "hospital", "admin"])
  test(`${role} has a distinct workspace and permitted navigation`, async () => {
    mock.user.role = role;
    render(<PortalDashboard />);
    await screen.findByText(
      "A clear view of what matters. A confident next step.",
    );
    await waitFor(() =>
      expect(
        screen.queryByLabelText("Loading workspace"),
      ).not.toBeInTheDocument(),
    );
    const nav = screen.getByRole("navigation", {
      name: "Workspace navigation",
    });
    expect(nav).toBeInTheDocument();
    if (role === "admin")
      expect(
        screen.getByRole("button", { name: "People & access" }),
      ).toBeInTheDocument();
    if (role === "hospital")
      expect(
        screen.getByRole("button", { name: "Screening workspace" }),
      ).toBeInTheDocument();
    if (role === "donor")
      expect(
        screen.getByRole("button", { name: "My pledges" }),
      ).toBeInTheDocument();
    if (role === "recipient")
      expect(
        screen.getByRole("button", { name: "My care timeline" }),
      ).toBeInTheDocument();
    if (role !== "admin")
      expect(
        screen.queryByRole("button", { name: "People & access" }),
      ).not.toBeInTheDocument();
  });
test("pledge form submits the selected organ to the authenticated endpoint", async () => {
  render(<PortalDashboard />);
  await waitFor(() =>
    expect(
      screen.queryByLabelText("Loading workspace"),
    ).not.toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole("button", { name: "New pledge" }));
  fireEvent.change(screen.getByLabelText("Organ"), {
    target: { value: "Liver" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save & continue" }));
  await waitFor(() =>
    expect(mock.fetch).toHaveBeenCalledWith(
      `/pledges/${uid}`,
      expect.objectContaining({
        method: "POST",
        token: "test-token",
        body: { organ: "Liver", donationType: "Living" },
      }),
    ),
  );
});
test("failed saves stay in the dialog and show server feedback", async () => {
  mock.fetch.mockImplementation(async (path, opts) => {
    if (opts?.method === "POST") throw new Error("Pledge already exists");
    return path === "/notifications" ? { notifications: [] } : [];
  });
  render(<PortalDashboard />);
  await waitFor(() =>
    expect(
      screen.queryByLabelText("Loading workspace"),
    ).not.toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole("button", { name: "New pledge" }));
  fireEvent.click(screen.getByRole("button", { name: "Save & continue" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Pledge already exists",
  );
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});
test("pending hospital cannot launch document review", async () => {
  mock.user.role = "hospital";
  mock.user.verificationState = "Pending";
  render(<PortalDashboard />);
  expect(
    screen.getByText("Hospital verification is pending"),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /Review documents/ }),
  ).toBeDisabled();
  await waitFor(() => expect(mock.fetch).toHaveBeenCalled());
  expect(
    mock.fetch.mock.calls.some(
      ([p]) => p === "/medical-records/hospital/pending",
    ),
  ).toBe(false);
});
test("donor acceptance needs confirmation and calls the correct status endpoint", async () => {
  mock.fetch.mockImplementation(async (path) =>
    path.includes("/donor/")
      ? [
          {
            _id: "cccccccccccccccccccccccc",
            organ: "Kidney",
            status: "Pending",
            recipientId: { fullName: "Recipient" },
          },
        ]
      : path === "/notifications"
        ? { notifications: [] }
        : [],
  );
  render(<PortalDashboard />);
  await waitFor(() =>
    expect(
      screen.queryByLabelText("Loading workspace"),
    ).not.toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Consent requests" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Review & accept" }),
  );
  expect(mock.fetch.mock.calls.some(([, o]) => o?.method === "PATCH")).toBe(
    false,
  );
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await waitFor(() =>
    expect(mock.fetch).toHaveBeenCalledWith(
      "/requests/cccccccccccccccccccccccc/status",
      expect.objectContaining({
        method: "PATCH",
        body: { status: "Accepted" },
      }),
    ),
  );
});
test("reset password rejects mismatch and completes the token flow", async () => {
  window.history.replaceState(
    {},
    "",
    `/?page=reset-password&token=${"a".repeat(64)}`,
  );
  render(<ResetPasswordPage />);
  fireEvent.change(screen.getByLabelText("New password"), {
    target: { value: "NewPass123!" },
  });
  fireEvent.change(screen.getByLabelText("Confirm password"), {
    target: { value: "Wrong123!" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Update password" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Passwords must match");
  fireEvent.change(screen.getByLabelText("Confirm password"), {
    target: { value: "NewPass123!" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Update password" }));
  await screen.findByText("Password updated");
  expect(mock.fetch).toHaveBeenCalledWith(
    `/users/reset-password/${"a".repeat(64)}`,
    { method: "POST", body: { password: "NewPass123!" } },
  );
});

test("an in-progress appointment cannot be completed before its end time", async () => {
  mock.user.role = "hospital";
  mock.fetch.mockImplementation(async (path) =>
    path === "/notifications"
      ? { notifications: [] }
      : path === "/appointments"
        ? [
            {
              _id: "dddddddddddddddddddddddd",
              organ: "Kidney",
              status: "scheduled",
              scheduledAt: new Date(Date.now() - 60000).toISOString(),
              scheduledEndAt: new Date(Date.now() + 3600000).toISOString(),
              durationMinutes: 90,
              surgeon: "Dr Test",
              user: { fullName: "Recipient" },
            },
          ]
        : path.includes("stats")
          ? {}
          : [],
  );
  render(<PortalDashboard />);
  await waitFor(() =>
    expect(
      screen.queryByLabelText("Loading workspace"),
    ).not.toBeInTheDocument(),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Appointments", exact: true }),
  );
  expect(
    await screen.findByRole("button", { name: "Complete", exact: true }),
  ).toBeDisabled();
  expect(screen.getByText("90 minutes · IST")).toBeInTheDocument();
});
test("rescheduling submits duration as a number and preserves the selected time", async () => {
  mock.user.role = "hospital";
  mock.fetch.mockImplementation(async (path) =>
    path === "/notifications"
      ? { notifications: [] }
      : path === "/appointments"
        ? [
            {
              _id: "dddddddddddddddddddddddd",
              organ: "Kidney",
              status: "scheduled",
              scheduledAt: "2030-06-15T03:30:00Z",
              scheduledEndAt: "2030-06-15T04:30:00Z",
              time: "09:00",
              durationMinutes: 60,
              surgeon: "Dr Test",
              user: { fullName: "Recipient" },
            },
          ]
        : path.includes("stats")
          ? {}
          : [],
  );
  render(<PortalDashboard />);
  await waitFor(() =>
    expect(
      screen.queryByLabelText("Loading workspace"),
    ).not.toBeInTheDocument(),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Appointments", exact: true }),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Reschedule", exact: true }),
  );
  fireEvent.change(screen.getByLabelText("Duration (minutes)"), {
    target: { value: "90" },
  });
  fireEvent.change(screen.getByLabelText("Appointment time · IST"), {
    target: { value: "11:00" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save & continue" }));
  await waitFor(() =>
    expect(mock.fetch).toHaveBeenCalledWith(
      "/appointments/dddddddddddddddddddddddd",
      expect.objectContaining({
        method: "PATCH",
        body: {
          date: "2030-06-15",
          time: "11:00",
          surgeon: "Dr Test",
          durationMinutes: 90,
        },
      }),
    ),
  );
});
