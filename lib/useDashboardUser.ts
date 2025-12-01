"use client";

import { useEffect, useState } from "react";

export type DashboardRole = "admin" | "viewer";

type DashboardUser = {
  id: string;
  email: string;
  role: DashboardRole;
};

export function useDashboardUser() {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/dashboard/me", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) {
          if (!cancelled) {
            setUser(null);
          }
          return;
        }

        const data = await res.json();
        if (!cancelled) {
          setUser({
            id: data.id,
            email: data.email,
            role: data.role,
          });
        }
      } catch (e) {
        console.error("[useDashboardUser] error:", e);
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    user,
    loading,
    role: user?.role ?? null,
  };
}
