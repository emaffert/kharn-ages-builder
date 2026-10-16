import { describe, expect, it } from "vitest";
import { countOf } from "./wording";

describe("countOf", () => {
  it("accorde au singulier pour 0 et 1, au pluriel au-delà", () => {
    expect(countOf(0, "esclave", "esclaves")).toBe("0 esclave");
    expect(countOf(1, "esclave", "esclaves")).toBe("1 esclave");
    expect(countOf(2, "esclave", "esclaves")).toBe("2 esclaves");
  });
});
