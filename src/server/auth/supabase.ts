import { createServerClient } from "@supabase/ssr";
import type { Request, Response } from "express";

export function createAuthClient(req: Request, res: Response) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || url.startsWith("replace-with-")) {
    throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!key || key.startsWith("replace-with-")) {
    throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createServerClient(url, key, {
    cookies: {
      getAll: () => Object.entries(req.cookies ?? {}).map(([name, value]) => ({ name, value: String(value) })),
      setAll: (values) => {
        for (const { name, value, options } of values) {
          req.cookies[name] = value;
          const { maxAge, ...rest } = options;
          res.cookie(name, value, { ...rest, ...(maxAge === undefined ? {} : { maxAge: maxAge * 1000 }), httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
        }
      },
    },
  });
}
