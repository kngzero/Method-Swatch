function distanceSq(a, b) {
  const dr = a.r - b.r; const dg = a.g - b.g; const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

export function mergeCloseColors(colors, threshold = 18) {
  if (!colors || colors.length === 0) return colors;
  const out = [];
  const used = new Array(colors.length).fill(false);
  for (let i = 0; i < colors.length; i++) {
    if (used[i]) continue;
    const baseColor = colors[i];
    if (baseColor.locked) {
      out.push({ ...baseColor });
      used[i] = true;
      continue;
    }
    let base = { ...baseColor };
    let totalCount = base.count || 1;
    used[i] = true;
    for (let j = i + 1; j < colors.length; j++) {
      if (used[j]) continue;
      const c = colors[j];
      if (c.locked) continue;
      const d = Math.sqrt(distanceSq(base, c));
      if (d <= threshold) {
        const w = c.count || 1;
        base = {
          r: Math.round((base.r * totalCount + c.r * w) / (totalCount + w)),
          g: Math.round((base.g * totalCount + c.g * w) / (totalCount + w)),
          b: Math.round((base.b * totalCount + c.b * w) / (totalCount + w)),
          count: totalCount + w,
          locked: base.locked || c.locked,
        };
        used[j] = true;
        totalCount += w;
      }
    }
    out.push(base);
  }
  return out;
}

export default mergeCloseColors;
