// Thread colours by plain name, and the nearest one to a brand colour. A stand-in list until the real thread chart
// is loaded; the names are colour words only.
const THREADS: [string, string][] = [
  ["Black", "#111111"], ["Soft black", "#2A2A2E"], ["Charcoal", "#4A4A4F"], ["Mid grey", "#8C8C8C"], ["Silver grey", "#C4C4C4"], ["White", "#FFFFFF"], ["Off white", "#F4F1EA"], ["Natural ecru", "#E8DDC8"],
  ["Sand", "#D2B48C"], ["Tan", "#B08D57"], ["Chocolate", "#4E342E"], ["Burnt terracotta", "#B5694A"], ["Rust", "#A0452B"], ["Red", "#C8102E"], ["Burgundy", "#6D1A36"], ["Coral", "#F26B5E"],
  ["Orange", "#F28C28"], ["Gold", "#D4A017"], ["Yellow", "#F6D21F"], ["Lime", "#A4C639"], ["Emerald", "#1E8E5A"], ["Deep moss green", "#4B5D43"], ["Forest green", "#1F4D3A"], ["Sage", "#9CAF88"],
  ["Teal", "#127C82"], ["Turquoise", "#2CB5C0"], ["Sky blue", "#7EC8E3"], ["Royal blue", "#1F4FBF"], ["Navy", "#14213D"], ["Purple", "#6A3FA0"], ["Lilac", "#B9A2D8"], ["Pink", "#EFA3B9"], ["Magenta", "#C2187A"],
];

export type Rgb = [number, number, number];
export const rgbOf = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
export const distance = (a: Rgb, b: Rgb) => Math.hypot((a[0] - b[0]) * 0.9, (a[1] - b[1]) * 1.2, (a[2] - b[2]) * 0.8);

export function nearestThread(hex: string): string {
  const c = rgbOf(hex);
  return THREADS.map(([name, h]) => ({ name, d: distance(c, rgbOf(h)) })).sort((a, b) => a.d - b.d)[0]!.name;
}
