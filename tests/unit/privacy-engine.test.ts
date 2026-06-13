import { describe, expect, it } from "vitest";
import { PrivacyEngine } from "../../src/privacy/privacy-engine.js";

describe("PrivacyEngine", () => {
  it("masks common sensitive values", () => {
    const engine = new PrivacyEngine();

    expect(engine.maskText("Contact max@example.com or +49 151 12345678")).toContain("[EMAIL]");
    expect(engine.maskText("Contact max@example.com or +49 151 12345678")).toContain("[PHONE]");
  });

  it("redacts configured sensitive field names", () => {
    const engine = new PrivacyEngine();

    expect(engine.maskFieldValue("password", "correct horse battery staple")).toBe("[REDACTED]");
    expect(engine.maskUnknown({ apiKey: "secret", name: "Alice Example" })).toEqual({
      apiKey: "[REDACTED]",
      name: "Alice Example"
    });
  });

  it("masks URL query values without corrupting localhost addresses", () => {
    const engine = new PrivacyEngine();

    expect(engine.maskUrl("http://127.0.0.1:4177/?email=anna.schmidt@example.com")).toBe(
      "http://127.0.0.1:4177/?email=%5BREDACTED%5D"
    );
  });
});
