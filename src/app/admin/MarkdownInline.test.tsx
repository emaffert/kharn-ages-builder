// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MarkdownInline } from "./MarkdownInline";

afterEach(cleanup);

describe("marques Markdown en ligne", () => {
  it("rend le gras, sans laisser les astérisques à l'écran", () => {
    const { container } = render(<MarkdownInline text="**Un casque par Safar**, sur son emplacement." />);
    expect(screen.getByText("Un casque par Safar").tagName).toBe("STRONG");
    expect(container.textContent).toBe("Un casque par Safar, sur son emplacement.");
  });

  it("rend l'italique et le code", () => {
    render(<MarkdownInline text="voir _la carte_ et `catalog.json`" />);
    expect(screen.getByText("la carte").tagName).toBe("EM");
    expect(screen.getByText("catalog.json").tagName).toBe("CODE");
  });

  it("laisse tel quel ce qu'il ne reconnaît pas", () => {
    const { container } = render(<MarkdownInline text="2 * 3 = 6, et [un lien](http://x) reste écrit" />);
    expect(container.textContent).toBe("2 * 3 = 6, et [un lien](http://x) reste écrit");
  });
});
