import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetRateLimits } from "./rate-limit";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

const post = async (body: BodyInit | null, headers: Record<string, string> = {}) => {
  const { POST } = await import("../app/api/verify/route");
  return POST(new Request("https://dev.yomizaka.com/api/verify", { method: "POST", body, headers: { "x-forwarded-for": "203.0.113.9", ...headers } }));
};

describe("POST /api/verify as a visitor (no account): memory only, small, rate-limited", () => {
  beforeEach(() => resetRateLimits());

  it("refuses an original document with 401", async () => {
    const form = new FormData();
    form.set("reportText", "<html></html>");
    form.set("document", new File(["x"], "lease.pdf"));
    expect((await post(form)).status).toBe(401);
  });

  it("refuses a body over the visitor cap (2 MB + 64 KB) with 413 before reading it", async () => {
    const res = await post("x", { "content-length": String(2 * 1024 * 1024 + 64 * 1024 + 1), "content-type": "multipart/form-data; boundary=x" });
    expect(res.status).toBe(413);
  });

  it("is limited per address: the 21st attempt in ten minutes is 429", async () => {
    let last = 0;
    for (let i = 0; i < 21; i++) last = (await post(new FormData())).status;
    expect(last).toBe(429);
  });
});
