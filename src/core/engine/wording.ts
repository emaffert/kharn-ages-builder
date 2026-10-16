/** countOf returns « n mot » accordé en nombre, au singulier pour 0 et 1 comme le veut le français. */
export function countOf(n: number, singular: string, plural: string): string {
  return `${n} ${n > 1 ? plural : singular}`;
}
