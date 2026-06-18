/** Backtracking assignment of qualified third-place groups to bracket slots. */
export function assignThirds(slotAllowed: string[][], qualified: string[]): (string | null)[] {
  const n = slotAllowed.length
  const used = new Set<string>()
  const out: (string | null)[] = Array(n).fill(null)
  const order = slotAllowed
    .map((allowed, i) => ({ i, allowed }))
    .sort(
      (x, y) =>
        x.allowed.filter((g) => qualified.includes(g)).length -
        y.allowed.filter((g) => qualified.includes(g)).length,
    )
  const bt = (k: number): boolean => {
    if (k === n) return true
    const { i, allowed } = order[k]
    for (const g of allowed) {
      if (!qualified.includes(g) || used.has(g)) continue
      used.add(g)
      out[i] = g
      if (bt(k + 1)) return true
      used.delete(g)
      out[i] = null
    }
    return false
  }
  bt(0)
  return out
}
