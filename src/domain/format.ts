export function formatRaw(raw: number, unit: string): string {
  const abs = Math.abs(raw)
  const digits = abs >= 100 || Number.isInteger(raw) ? 0 : abs >= 10 ? 1 : 2
  const trimmed = raw.toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')
  const negative = trimmed.startsWith('-')
  const [whole, frac] = (negative ? trimmed.slice(1) : trimmed).split('.')
  const grouped = (whole ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const value = `${negative ? '-' : ''}${grouped}${frac ? `.${frac}` : ''}`
  return `${value} ${unit}`
}

export function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name
}
