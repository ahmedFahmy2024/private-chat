import { treaty } from "@elysiajs/eden";
import type { App } from "@/app/api/[[...slugs]]/route";

export const api = treaty<App>(
  typeof window === "undefined"
    ? `http://localhost:${process.env.PORT || 3000}`
    : typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000",
).api;
