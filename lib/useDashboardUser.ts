// lib/useDashboardUser.ts
"use client";

import { useEffect, useState } from "react";

type DashboardUser = {
  email: string;
  role: string;
};

type UseDashboardUserResult = {
  user: DashboardUser | null;
  role: string | null;
  loading: boolean;
};

export function useDashboardUser(): UseDashboardUserResult {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/dashboard/me", {
          method: "GET",
          credentials: "include",
        });

        if (!res.ok) {
          if (!cancelled) {
            setUser(null);
            setRole(null);
          }
          return;
        }

        const data = await res.json();
        if (cancelled) return;

        if (data.user) {
          setUser(data.user);
          setRole(data.user.role ?? null);
        } else {
          setUser(null);
          setRole(null);
        }
      } catch (err) {
        console.error("[useDashboardUser] error loading user", err);
        if (!cancelled) {
          setUser(null);
          setRole(null);
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

  return { user, role, loading };
}
