import { NextResponse } from "next/server";
import type { ApiResponse, ApiMeta } from "./types";

/** Successful JSON response */
export function ok<T>(
  data: T,
  meta?: Omit<ApiMeta, "generated_at">,
  status = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      data,
      error: null,
      meta: { ...meta, generated_at: new Date().toISOString() },
    },
    { status }
  );
}

/** Error JSON response — never leaks raw Supabase messages to callers */
export function err(
  message: string,
  status = 500
): NextResponse<ApiResponse<null>> {
  return NextResponse.json({ data: null, error: message }, { status });
}

/** 400 Bad Request shorthand */
export const badRequest = (msg: string) => err(msg, 400);

/** 401 Unauthorized shorthand */
export const unauthorized = () => err("Unauthorized", 401);

/** 403 Forbidden shorthand */
export const forbidden = () => err("Forbidden", 403);

/** 404 Not Found shorthand */
export const notFound = (resource = "Resource") =>
  err(`${resource} not found`, 404);
