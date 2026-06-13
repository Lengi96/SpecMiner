import { describe, expect, it } from "vitest";
import { createProvider } from "../../src/llm/providers.js";

describe("createProvider", () => {
  it("creates disabled provider by default", () => {
    expect(createProvider().name).toBe("disabled");
  });

  it("creates ollama provider with local endpoint", () => {
    const provider = createProvider("local-ollama");

    expect(provider.name).toBe("local-ollama");
  });
});
