/** Affichage d'un coût en Kouronnes (or). */
export function Coin({ value, unit = "Ko" }: { value: number | string; unit?: string }) {
  return (
    <span className="ui-coin">
      {value}
      <span className="ui-coin__unit">{unit}</span>
    </span>
  );
}
