import { type NextRequest } from "next/server";
import { ok, err, unauthorized, badRequest } from "@/lib/api/response";
import { getAdminContext } from "@/lib/api/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { isUuid } from "@/app/api/_lib/validate";
import type { InviteResult, UserRole } from "@/lib/api/types";

const VALID_ROLES: UserRole[] = ["admin", "team"];

// ---------------------------------------------------------------------------
// POST /api/invites
//
// Admin only.  Sends a Supabase Auth invite email.  On sign-up the invited
// user's profile is pre-populated with the given team_id and role.
//
// Body:
//   {
//     email:    string,
//     role:     "admin" | "team",
//     team_id?: string   // required when role = "team"
//   }
//
// Returns 201 with InviteResult on success.
//
// Implementation notes:
//   • supabase.auth.admin.inviteUserByEmail() requires the service-role key
//     — we use createServiceClient() for the auth operation while still
//     verifying the caller's identity with getAdminContext() (cookie client).
//   • The on_auth_user_created trigger auto-creates a profile with role='team'.
//     We upsert the profile afterward to set the correct role and team_id.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    // Verify the caller is an authenticated admin via their session cookie
    const ctx = await getAdminContext();
    if (!ctx) return unauthorized();

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return badRequest("Invalid JSON body");

    const { email, role, team_id = null } = body as Record<string, unknown>;

    // ── Validate ──────────────────────────────────────────────────────────
    // Basic RFC-5321 surface check — Supabase enforces full validation
    if (
      !email ||
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return badRequest("email must be a valid email address");
    }
    if (!VALID_ROLES.includes(role as UserRole)) {
      return badRequest(`role must be one of: ${VALID_ROLES.join(", ")}`);
    }
    if (role === "team") {
      if (!isUuid(team_id)) {
        return badRequest("team_id is required and must be a valid UUID when role is 'team'");
      }
    }
    if (team_id !== null && !isUuid(team_id)) {
      return badRequest("team_id must be a valid UUID");
    }

    // ── Confirm team exists (when provided) ───────────────────────────────
    if (team_id !== null) {
      const { data: team, error: teamErr } = await ctx.supabase
        .from("teams")
        .select("id, active")
        .eq("id", team_id)
        .single();

      if (teamErr || !team) {
        return badRequest("team_id does not refer to an existing team");
      }
      if (!team.active) {
        return badRequest("Cannot invite to an inactive team");
      }
    }

    // ── Send invite via service-role client ───────────────────────────────
    const svc = createServiceClient();

    const { data: inviteData, error: inviteErr } = await svc.auth.admin.inviteUserByEmail(
      email.toLowerCase().trim(),
      {
        data: {
          // raw_user_meta_data — available to the app and to the handle_new_user trigger
          role:    role,
          team_id: team_id ?? null,
        },
      }
    );

    if (inviteErr) {
      // Surface a human-readable message without leaking Supabase internals
      const msg = inviteErr.message?.toLowerCase() ?? "";
      if (msg.includes("already registered") || msg.includes("already been invited")) {
        return err("A user with that email address already exists or has been invited", 409);
      }
      if (msg.includes("invalid") && msg.includes("email")) {
        return badRequest("Email address is invalid");
      }
      if (msg.includes("rate limit")) {
        return err("Invite rate limit reached — please try again later", 429);
      }
      console.error("[invites] POST invite error", inviteErr.message);
      return err("Failed to send invite");
    }

    const invitedUser = inviteData.user;
    if (!invitedUser) {
      return err("Invite sent but user data not returned");
    }

    // ── Update the auto-created profile with correct role + team_id ───────
    // The on_auth_user_created trigger already inserted a profile with role='team'.
    // Upsert here to set the actual intended role and team assignment.
    const { error: profileErr } = await svc
      .from("profiles")
      .upsert(
        {
          id:      invitedUser.id,
          role:    role    as UserRole,
          team_id: team_id ?? null,
        },
        { onConflict: "id" }
      );

    if (profileErr) {
      // The invite was sent — log the error but don't fail the request.
      // An admin can manually fix the profile via the DB if needed.
      console.error(
        "[invites] POST profile upsert error (invite was sent)",
        profileErr.message
      );
    }

    const result: InviteResult = {
      id:         invitedUser.id,
      email:      invitedUser.email ?? email,
      team_id:    (team_id as string | null) ?? null,
      role:       role as UserRole,
      invited_at: invitedUser.created_at ?? new Date().toISOString(),
    };

    return ok(result, undefined, 201);
  } catch (e) {
    console.error("[invites] POST unexpected error", e);
    return err("Internal server error");
  }
}
