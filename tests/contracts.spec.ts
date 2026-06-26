import { describe, expect, it } from "vitest";
import type { TextCensor, TextGuard, TextGuardResult } from "../src/index.js";

describe("textfilters core contracts", () => {
  it("allows censors and guards to share stable shapes", () => {
    const censor: TextCensor = {
      name: "test-censor",
      censor: (value) => value.replace("secret", "******"),
    };
    const result: TextGuardResult = {
      allowed: false,
      reason: "blocked",
    };
    const guard: TextGuard = {
      name: "test-guard",
      check: () => result,
    };

    expect(censor.censor("secret")).toBe("******");
    expect(guard.check({ text: "value" })).toEqual(result);
  });
});
