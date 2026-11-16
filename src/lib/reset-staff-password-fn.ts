import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// NOTE on placement: mirrors create-staff-fn.ts — this must NOT live under
// src/server/** (the repo's import-protection bans client imports of that
// path). The SUPABASE_SERVICE_ROLE_KEY is read from process.env inside the
// handler, which only ever executes on the server.
//
// Why a server fn instead of a client-side UPDATE: the password lives in
// auth.users, which only the service role can write (030/034 give the client
// nothing on it), and must_change_password on to_staff has no staff UPDATE
// path by design (034:41 is superadmin-only). This function is the one
// sanctioned write path for admin-managed password resets.

const inputSchema = z.object({
  userId: z.string().uuid("Invalid user id"),
  newPassword: z
    .string()
    .min(8, "Temporary password must be at least 8 characters")
    .max(128),
  // Caller's own access token (supabase-js keeps it in localStorage, so it
  // is passed explicitly — server functions don't forward it automatically).
  accessToken: z.string().min(1),
});

export type ResetStaffPasswordInput = z.infer<typeof inputSchema>;

export type ResetStaffPasswordResult =
  | {
      ok: true;
      isSelf: boolean;
      target: { id: string; email: string; fullName: string };
    }
  | {
      ok: false;
      code:
        | "unauthorized"
        | "forbidden"
        | "inactive_target"
        | "not_found"
        | "weak_password"
        | "misconfigured"
        | "failed";
      message: string;
    };

const fail = (
  code: Extract<ResetStaffPasswordResult, { ok: false }>["code"],
  message: string,
): ResetStaffPasswordResult => ({ ok: false, code, message });

/**
 * Admin-managed password reset for a non-real-mailbox staff account.
 *
 * The admin types the temporary password (same out-of-band handover as the
 * invite dialog), the service role writes it into auth.users, the target's
 * other sessions are revoked, and — unless the target is the caller themself
 * — the account is flagged so the dashboard blocks everything until the
 * staffer sets their own new password. The flag lives in to_staff
 * (043) where the staffer can read it at login via their own-row SELECT.
 */
export const resetStaffPassword = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message || "Invalid input.");
    }
    return parsed.data;
  })
  .handler(async ({ data }): Promise<ResetStaffPasswordResult> => {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return fail(
        "misconfigured",
        "Password reset isn't configured on the server (service key missing).",
      );
    }
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Verify the caller: a valid JWT belonging to an active superadmin.
    // Never trust a client-asserted role — the tier comes from to_staff.
    const {
      data: { user: caller },
      error: callerError,
    } = await admin.auth.getUser(data.accessToken);
    if (callerError || !caller) {
      return fail(
        "unauthorized",
        "Your session is invalid. Please sign in again.",
      );
    }
    const { data: callerRow, error: callerRowError } = await admin
      .from("to_staff")
      .select("role, is_active")
      .eq("id", caller.id)
      .maybeSingle();
    if (callerRowError || !callerRow) {
      return fail("forbidden", "Only superadmins can reset staff passwords.");
    }
    const callerRole = (callerRow as { role?: string | null }).role;
    const callerActive =
      (callerRow as { is_active?: boolean }).is_active !== false;
    if (!callerActive || callerRole !== "superadmin") {
      return fail("forbidden", "Only superadmins can reset staff passwords.");
    }

    // 2. Resolve the target. Missing row = removed (delete cascades both sides).
    const { data: target, error: targetError } = await admin
      .from("to_staff")
      .select("id, email, full_name, is_active, must_change_password")
      .eq("id", data.userId)
      .maybeSingle();
    if (targetError) {
      return fail("failed", `Staff lookup failed: ${targetError.message}`);
    }
    if (!target) {
      return fail(
        "not_found",
        "That account is no longer on the staff roster.",
      );
    }
    if ((target as { is_active?: boolean }).is_active === false) {
      return fail(
        "inactive_target",
        "Reactivate this account first — a suspended staffer can't sign in to accept a new password.",
      );
    }

    const isSelf = caller.id === data.userId;
    const prevFlag =
      (target as { must_change_password?: boolean }).must_change_password ??
      false;

    // 3. Arm the forced-change flag first (target != caller) in to_staff.
    // Setting this before Auth ensures an account is never assigned a new
    // password without the required gate being actively armed.
    const { error: flagError } = await admin
      .from("to_staff")
      .update({ must_change_password: !isSelf })
      .eq("id", data.userId);
    if (flagError) {
      return fail(
        "failed",
        `Could not arm password change requirement: ${flagError.message}`,
      );
    }

    // 4. Write the new password into auth.users (auto-confirmed account).
    const { error: updateError } = await admin.auth.admin.updateUserById(
      data.userId,
      { password: data.newPassword },
    );
    if (updateError) {
      // Revert the flag to its previous state if updating the password failed
      try {
        await admin
          .from("to_staff")
          .update({ must_change_password: prevFlag })
          .eq("id", data.userId);
      } catch (revertErr) {
        console.error("Failed to revert must_change_password flag:", revertErr);
      }

      const msg = updateError.message;
      if (/password/i.test(msg)) return fail("weak_password", msg);
      return fail("failed", `Could not set the new password: ${msg}`);
    }

    // 5. Revoke the target's other sessions when resetting someone else — a
    // password the target no longer knows must not keep any session alive.
    if (!isSelf) {
      try {
        await admin.auth.admin.signOut(data.userId, "others");
      } catch {
        /* best-effort: the forced password change gate still closes the
           window on next login */
      }
    }

    return {
      ok: true,
      isSelf,
      target: {
        id: (target as { id: string }).id,
        email: (target as { email: string }).email,
        fullName: (target as { full_name: string }).full_name,
      },
    };
  });
