// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { Verbatim } from "./components";

afterEach(cleanup);

// Une carte va à la ligne pour séparer ses règles (les trois atouts de Mathys, les effets d'un
// casque) : rendues d'un bloc, ces lignes se collaient les unes aux autres.
describe("texte de carte en paragraphes", () => {
  const CARTE = "- Ombre-Glace : +3 en ATT.\n- Marque de Mathys : soudoie un Safar.\n- Inspiration : si Mathys est leader.";

  it("fait un paragraphe de chaque ligne", () => {
    const { container } = render(<Verbatim text={CARTE} className="mdl-verb" />);
    const paras = container.querySelectorAll("p.mdl-verb");
    expect(paras).toHaveLength(3);
    expect(paras[0].textContent).toBe("- Ombre-Glace : +3 en ATT.");
    expect(paras[2].textContent).toBe("- Inspiration : si Mathys est leader.");
  });

  it("ne produit pas de paragraphe vide sur une ligne blanche", () => {
    const { container } = render(<Verbatim text={"Premier alinéa.\n\n   \nSecond alinéa."} className="mdl-verb" />);
    expect(container.querySelectorAll("p")).toHaveLength(2);
  });

  it("laisse un texte d'un seul tenant en un seul paragraphe", () => {
    const { container } = render(<Verbatim text="Une règle courte." className="mdl-line" />);
    expect(container.querySelectorAll("p.mdl-line")).toHaveLength(1);
  });
});
