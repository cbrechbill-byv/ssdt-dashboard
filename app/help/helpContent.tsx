// app/help/helpContent.tsx
// Single source of truth for ALL Help content.
// Edit this file to update the in-dashboard user manual.

import React from "react";

export type HelpRole = "staff" | "admin";

export type HelpItem = {
  id: string;
  title: string;
  roles?: HelpRole[]; // omit = visible to all
  keywords?: string[];
  content: React.ReactNode;
};

export const HELP_SECTIONS: HelpItem[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    keywords: ["login", "password", "reset", "invite", "timezone", "ET"],
    content: (
      <>
        <p>
          Welcome to the <b>Sugarshack Downtown Staff Dashboard</b>. This help
          guide explains what each page means, what actions you can take, and
          how to interpret the data.
        </p>

        <h3>Who this is for</h3>
        <ul>
          <li><b>Staff</b>: day-to-day VIP redemptions and operations.</li>
          <li><b>Admins</b>: manage users, configuration, and auditing.</li>
        </ul>

        <h3>Timezone</h3>
        <p>
          All “today” counts and daily summaries use{" "}
          <b>America/New_York (ET)</b>. This prevents confusion between server
          UTC time and venue time.
        </p>

        <h3>Passwords</h3>
        <ul>
          <li>Admins do <b>not</b> set passwords.</li>
          <li>Users set passwords via a secure link emailed to them.</li>
          <li>
            If you forget your password, use <b>Forgot password</b> on the login
            page.
          </li>
        </ul>
      </>
    ),
  },

  {
    id: "navigation",
    title: "How Navigation Works",
    keywords: ["menu", "tabs", "dropdown", "rewards", "notifications", "admin"],
    content: (
      <>
        <p>
          The top navigation contains primary sections. Some items are
          “containers” that open a dropdown with multiple pages.
        </p>

        <h3>Container menus</h3>
        <ul>
          <li>
            <b>Rewards</b> opens a dropdown: Rewards (main), Overview, VIP Users,
            Staff Codes.
          </li>
          <li>
            <b>Notifications</b> opens a dropdown: Notifications (main),
            Analytics.
          </li>
          <li>
            <b>Admin</b> opens a dropdown: Admin Users, Help.
          </li>
        </ul>

        <h3>Active tab</h3>
        <p>
          The highlighted pill shows the section you’re currently in. Dropdown
          items still count as being inside their parent section.
        </p>
      </>
    ),
  },

  {
    id: "dashboard-home",
    title: "Dashboard Home",
    keywords: ["dashboard", "home", "kpi", "summary"],
    content: (
      <>
        <p>
          The Dashboard is the high-level overview of VIP activity, redemptions,
          and operational health.
        </p>

        <h3>What to look for</h3>
        <ul>
          <li>Big shifts vs yesterday (spikes or drops)</li>
          <li>Redemption Health warnings (data integrity checks)</li>
          <li>Unexpected zero counts during business hours</li>
        </ul>

        <h3>Common questions</h3>
        <ul>
          <li>
            <b>“Why does today look low?”</b> — check ET time window and the
            venue’s operating hours.
          </li>
          <li>
            <b>“Why are numbers delayed?”</b> — some cards update in near
            real-time, others are based on “today” summaries.
          </li>
        </ul>
      </>
    ),
  },

  {
    id: "rewards-main",
    title: "Rewards (Main Page)",
    keywords: ["rewards", "points", "vip", "redeem"],
    content: (
      <>
        <p>
          Rewards is the operational hub for VIP points and redemptions.
          Redeeming a reward spends points and records who approved it.
        </p>

        <h3>What rewards are</h3>
        <ul>
          <li>VIP points are earned through activity (scans/check-ins).</li>
          <li>Rewards convert points into real benefits (perks/discounts).</li>
          <li>Every redemption is logged for auditing.</li>
        </ul>

        <h3>Best practices</h3>
        <ul>
          <li>Always use your staff code when redeeming.</li>
          <li>Confirm the VIP user identity before redemption.</li>
          <li>If something looks wrong, notify an admin.</li>
        </ul>
      </>
    ),
  },

  {
    id: "rewards-overview",
    title: "Rewards → Overview",
    keywords: ["rewards", "overview", "stats", "totals"],
    content: (
      <>
        <p>
          Overview summarizes reward usage and VIP activity at a higher level.
        </p>

        <h3>Use this page to</h3>
        <ul>
          <li>Spot trends in redemptions</li>
          <li>Compare day-over-day performance</li>
          <li>Identify unusually high redemption periods</li>
        </ul>
      </>
    ),
  },

  {
    id: "rewards-vips",
    title: "Rewards → VIP Users",
    keywords: ["vip", "users", "points", "history", "profile"],
    content: (
      <>
        <p>
          VIP Users shows the people in the rewards system and how points are
          earned and spent.
        </p>

        <h3>What you can do</h3>
        <ul>
          <li>Search for a VIP user</li>
          <li>Review points balance and redemption history</li>
          <li>Validate whether a redemption matches expectations</li>
        </ul>

        <h3>Common issue</h3>
        <p>
          If a VIP claims their points are wrong, check their history first
          (scans/check-ins vs redemptions), then escalate to an admin if needed.
        </p>
      </>
    ),
  },

  {
    id: "rewards-staff-codes",
    title: "Rewards → Staff Codes",
    keywords: ["staff", "codes", "pin", "accountability", "last4"],
    content: (
      <>
        <p>
          Staff Codes are used to approve redemptions. The system stores staff
          identification (label) and the last 4 digits used at redemption time
          for accountability.
        </p>

        <h3>Why this exists</h3>
        <ul>
          <li>Auditing: who redeemed what, and when</li>
          <li>Reducing fraud/mistakes</li>
          <li>Operational tracking for managers</li>
        </ul>
      </>
    ),
  },

  {
    id: "redemption-health",
    title: "Redemption Health (Data Checks)",
    keywords: ["health", "data checks", "missing staff", "orphan", "invalid points"],
    content: (
      <>
        <p>
          Redemption Health is a daily integrity monitor for the rewards pipeline.
          It flags incomplete or suspicious records for <b>today (ET)</b>.
        </p>

        <h3>Checks</h3>
        <ul>
          <li>
            <b>Missing staff</b> — staff label or staff last4 missing (audit trail
            incomplete)
          </li>
          <li>
            <b>Missing reward</b> — reward name missing (reporting becomes unreliable)
          </li>
          <li>
            <b>Invalid points</b> — points spent is 0 or negative (logic issue)
          </li>
          <li>
            <b>Orphan signal</b> — redemption has no matching scan record for that
            user today (not always bad, but useful to detect broken auto check-in)
          </li>
        </ul>

        <h3>How to use it</h3>
        <ul>
          <li>All zeros = clean pipeline (ideal).</li>
          <li>
            Non-zero counts = investigate the underlying redemption(s) and
            confirm data capture is functioning.
          </li>
        </ul>
      </>
    ),
  },

  {
    id: "notifications-main",
    title: "Notifications (Main Page)",
    keywords: ["notifications", "push", "send", "message"],
    content: (
      <>
        <p>
          Notifications are used to send messages to app users (promos, updates,
          reminders). The main page is where you compose and send.
        </p>

        <h3>Best practices</h3>
        <ul>
          <li>Keep messages short and clear.</li>
          <li>Send at appropriate times for ET audiences.</li>
          <li>Coordinate with venue events and promos.</li>
        </ul>
      </>
    ),
  },

  {
    id: "notifications-analytics",
    title: "Notifications → Analytics",
    keywords: ["notifications", "analytics", "delivery", "open", "click"],
    content: (
      <>
        <p>
          Analytics summarizes how notifications performed (delivery trends,
          engagement signals).
        </p>

        <h3>Important note</h3>
        <p>
          Open/click metrics can be directional rather than exact, depending on
          platform restrictions. Use trends over time.
        </p>
      </>
    ),
  },

  {
    id: "artists",
    title: "Artists",
    keywords: ["artists", "profiles", "calendar"],
    content: (
      <>
        <p>
          Artists includes performer data used across the calendar and other
          promotional surfaces.
        </p>
        <p>
          Use this page to keep artist information accurate and consistent.
        </p>
      </>
    ),
  },

  {
    id: "events",
    title: "Events",
    keywords: ["events", "calendar", "schedule"],
    content: (
      <>
        <p>
          Events manages the calendar schedule that appears to users. Verify
          times, titles, and featured content.
        </p>
      </>
    ),
  },

  {
    id: "fan-wall",
    title: "Fan Wall",
    keywords: ["fan wall", "ugc", "photos"],
    content: (
      <>
        <p>
          Fan Wall is a curated view of user-submitted content. Use moderation
          tools as needed to keep content appropriate for display.
        </p>
      </>
    ),
  },

  {
    id: "photo-booth",
    title: "Photo Booth",
    keywords: ["photo booth", "frames", "overlays"],
    content: (
      <>
        <p>
          Photo Booth controls the frames/overlays available in the mobile app.
          Update overlays when sponsor promotions change.
        </p>
      </>
    ),
  },

  {
    id: "sponsors",
    title: "Sponsors",
    keywords: ["sponsors", "gallery", "highlights"],
    content: (
      <>
        <p>
          Sponsors includes sponsor cards and assets used in-app. Keep sponsor
          details up-to-date and aligned with agreements.
        </p>
      </>
    ),
  },

  {
    id: "bar-bites",
    title: "Bar & Bites",
    keywords: ["menu", "bar", "bites", "food"],
    content: (
      <>
        <p>
          Bar & Bites manages the menu content shown in the app/dashboard.
          Update items, pricing, and availability as needed.
        </p>
      </>
    ),
  },

  {
    id: "feedback",
    title: "Feedback",
    keywords: ["feedback", "booking", "form"],
    content: (
      <>
        <p>
          Feedback collects messages from users (questions, requests, booking
          interest). Review regularly and route messages to the right staff.
        </p>
      </>
    ),
  },

  {
    id: "activity-log",
    title: "Activity Log",
    keywords: ["audit", "activity", "log", "history"],
    content: (
      <>
        <p>
          Activity Log is the audit trail of key actions taken in the dashboard.
          Managers use this for accountability and troubleshooting.
        </p>
      </>
    ),
  },

  {
    id: "admin-users",
    title: "Admin Users (Access & Roles)",
    roles: ["admin"],
    keywords: ["admin", "users", "roles", "invite", "reset password"],
    content: (
      <>
        <p>
          Admin Users controls dashboard access. This is admin-only.
        </p>

        <h3>Adding a user</h3>
        <ul>
          <li>Create the user (email + role).</li>
          <li>
            Use <b>Reset password</b> to send a secure set-password email.
          </li>
        </ul>

        <h3>Why admins never set passwords</h3>
        <ul>
          <li>Passwords are not emailed in plaintext.</li>
          <li>Admins should never know staff passwords.</li>
          <li>Secure tokens expire and can be revoked by reissuing.</li>
        </ul>
      </>
    ),
  },

  {
    id: "troubleshooting",
    title: "Troubleshooting & FAQs",
    keywords: ["faq", "issues", "troubleshoot", "support"],
    content: (
      <>
        <h3>I didn’t get a password reset email</h3>
        <ul>
          <li>Check spam/junk folders.</li>
          <li>Confirm the email exists in Admin Users.</li>
          <li>Admins can re-send using Reset password.</li>
        </ul>

        <h3>Numbers look wrong today</h3>
        <ul>
          <li>Confirm ET time window.</li>
          <li>Check Redemption Health for non-zero warnings.</li>
          <li>Escalate to an admin if anomalies persist.</li>
        </ul>
      </>
    ),
  },
];
