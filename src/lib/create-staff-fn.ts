import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// NOTE on placement: this file must NOT live under src/server/** — the
// repo's import-protection bans client imports of that path, and the route
// component calls this function via the framework's RPC bridge. The
// SUPABASE_SERVICE_ROLE_KEY is still server-only: it is read from
// process.env inside the handler (which executes exclusively on the
// server), and Vite never bakes non-VITE_ vars into the client bundle.

const inputSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required").max(120),
  email: z.string().trim().toLowerCase().email("Invalid email").max(320),
  password: z.string().min(8, "Temporary password must be at least 8 characters").max(128),
  role: z.enum(["staff", "superadmin"]),
  // Caller’s own access token (supabase-js keeps it in localStorage, so it
  // is passed explicitly — server functions don’t forward it automatically).
  accessToken: z.string().min(1),
});

export type CreateStaffInput = z.infer<typeof inputSchema>;

export type CreateStaffResult =
  | {
      ok: true;
      status: "created" | "linked" | "already_staff";
      user: { id: string; email: string; fullName: string; role: "staff" | "superadmin" };
    }
  | { ok: false; code: "unauthorized" | "forbidden" | "misconfigured" | "duplicate" | "weak_password" | "lookup_failed" | "invalid_input" | "failed"; message: string };

const fail = (code: Extract<CreateStaffResult, { ok: false }>["code"], message: string): CreateStaffResult => ({
  ok: false,
  code,
  message,
});

async function findAuthUserIdByEmail(
  admin: { listUsers: (opts: { page: number; perPage: number }) => Promise<{ data: { users: { id: string; email?: string }[] }; error: unknown }> },
  email: string
): Promise<string | null> {
  const target = email.toLowerCase();
  // Staff+tourist user base is small; cap the scan and fail loudly past it.
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email || "").toLowerCase() === target);
    if (hit) return hit.id;
    if (data.users.length < 1000) return null;
  }
  return null;
}

export const createStaffAccount = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message || "Invalid input.");
    }
    return parsed.data;
  })
  .handler(async ({ data }): Promise<CreateStaffResult> => {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return fail(
        "misconfigured",
        "Staff creation isn't configured on the server (service key missing)."
      );
    }
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Verify the caller: valid JWT belonging to an active superadmin.
    // Never trust a client-sent role — the tier comes from to_staff.
    const {
      data: { user: caller },
      error: callerError,
    } = await admin.auth.getUser(data.accessToken);
    if (callerError || !caller) {
      return fail("unauthorized", "Your session is invalid. Please sign in again.");
    }
    const { data: callerRow, error: callerRowError } = await admin
      .from("to_staff")
      .select("role, is_active")
      .eq("id", caller.id)
      .maybeSingle();
    if (callerRowError || !callerRow) {
      return fail("forbidden", "Only superadmins can create staff accounts.");
    }
    const callerRole = (callerRow as { role?: string | null }).role;
    const callerActive = (callerRow as { is_active?: boolean }).is_active !== false;
    if (!callerActive || callerRole !== "superadmin") {
      return fail("forbidden", "Only superadmins can create staff accounts.");
    }

    // 2. Already staff? Short-circuit before touching Auth (covers re-invite
    // and manual-flow orphans without duplicate writes).
    const { data: existing, error: existingError } = await admin
      .from("to_staff")
      .select("id, email, full_name, role")
      .eq("email", data.email)
      .maybeSingle();
    if (existingError) {
      return fail("failed", `Staff lookup failed: ${existingError.message}`);
    }
    if (existing) {
      return {
        ok: true,
        status: "already_staff",
        user: {
          id: existing.id,
          email: existing.email,
          fullName: existing.full_name,
          role: existing.role === "superadmin" ? "superadmin" : "staff",
        },
      };
    }

    // 3. Mint the auth user (auto-confirmed — no SMTP dependency), then link.
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    let userId = created?.user?.id ?? null;
    if (createError || !userId) {
      const msg = createError?.message || "Account creation failed.";
      // Duplicate email with no staff row = orphan (e.g. tourist account or
      // manual-flow leftover) → locate and link instead of failing.
      if (/already (been )?registered|already exists|duplicate/i.test(msg)) {
        try {
          userId = await findAuthUserIdByEmail(admin.auth.admin, data.email);
        } catch {
          userId = null;
        }
        if (!userId) {
          return fail(
            "lookup_failed",
            "An account with this email exists but couldn't be located. Link it manually via SQL."
          );
        }
      } else if (/password/i.test(msg)) {
        return fail("weak_password", msg);
      } else {
        return fail("failed", msg);
      }
    }

    const { error: linkError } = await admin.from("to_staff").insert({
      id: userId,
      email: data.email,
      full_name: data.fullName,
      role: data.role,
    });
    if (linkError) {
      // Rollback newly minted auth user to keep staff creation atomic
      if (created?.user?.id) {
        try {
          await admin.auth.admin.deleteUser(created.user.id);
        } catch (cleanupErr) {
          console.error("Failed to clean up orphaned auth user after link error:", cleanupErr);
        }
      }
      return fail("failed", `Staff linking failed: ${linkError.message}. Auth user creation was rolled back.`);
    }
    return {
      ok: true,
      status: created?.user ? "created" : "linked",
      user: { id: userId, email: data.email, fullName: data.fullName, role: data.role },
    };
  });
