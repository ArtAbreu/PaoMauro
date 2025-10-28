import { describe, expect, it } from "vitest";
import { rateLimitApi, rateLimitLogin } from "@/lib/rate-limit";

describe("rate limiter", () => {
  it("allows limited login attempts", () => {
    let allowed = true;
    for (let i = 0; i < 10; i += 1) {
      allowed = rateLimitLogin("user@example.com");
    }
    expect(allowed).toBe(true);
    expect(rateLimitLogin("user@example.com")).toBe(false);
  });

  it("separates namespaces for api and login", () => {
    for (let i = 0; i < 60; i += 1) {
      expect(rateLimitApi(`ip-${i}`)).toBe(true);
    }
    expect(rateLimitApi("ip-0")).toBe(false);
    expect(rateLimitLogin("ip-0")).toBe(true);
  });
});
