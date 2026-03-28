import { type NextRequest } from "next/server";
import { ok, err, unauthorized, notFound, badRequest } from "@/lib/api/response";
import { getAdminContext } from "@/lib/api/auth";
import type { LaneDetail } from "@/lib/api/types";

/**
 * PUT /api/lanes/[id]
 *
 * Admin only. Updates an existing lane. All fields optional.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAdminContext();
    if (!ctx) return unauthorized();

    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return badRequest("Invalid JSON body");

    const b = body as Record<string, unknown>;
    const payload: Record<string, unknown> = {};

    if ("name" in b) {
      if (typeof b.name !== "string" || b.name.trim().length === 0) {
        return badRequest("name must be a non-empty string");
      }
      payload.name = b.name.trim();
    }

    if ("sort_order" in b) {
      if (typeof b.sort_order !== "number") {
        return badRequest("sort_order must be a number");
      }
      payload.sort_order = b.sort_order;
    }

    if ("active" in b) {
      if (typeof b.active !== "boolean") {
        return badRequest("active must be a boolean");
      }
      payload.active = b.active;
    }

    if ("notes" in b) {
      if (b.notes !== null && typeof b.notes !== "string") {
        return badRequest("notes must be a string or null");
      }
      payload.notes = b.notes ?? null;
    }

    if (Object.keys(payload).length === 0) {
      return badRequest("No updatable fields provided");
    }

    const { data, error } = await ctx.supabase
      .from("lanes")
      .update(payload)
      .eq("id", id)
      .select("id, space_id, name, sort_order, active, notes")
      .single();

    if (error) {
      if (error.code === "PGRST116") return notFound("Lane");
      console.error("[lanes/[id]] PUT error", error.message);
      return err("Failed to update lane");
    }

    return ok(data as LaneDetail);
  } catch (e) {
    console.error("[lanes/[id]] PUT unexpected error", e);
    return err("Internal server error");
  }
}

/**
 * DELETE /api/lanes/[id]
 *
 * Admin only. Deletes a lane.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAdminContext();
    if (!ctx) return unauthorized();

    const { id } = await params;

    const { error } = await ctx.supabase
      .from("lanes")
      .delete()
      .eq("id", id);

    if (error) {
      if (error.code === "PGRST116") return notFound("Lane");
      console.error("[lanes/[id]] DELETE error", error.message);
      return err("Failed to delete lane");
    }

    return ok({ deleted: true });
  } catch (e) {
    console.error("[lanes/[id]] DELETE unexpected error", e);
    return err("Internal server error");
  }
}
