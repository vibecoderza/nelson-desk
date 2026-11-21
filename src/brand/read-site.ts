// Reading a brand from a web page: its name, a short summary, its colours, its fonts and where its logo is. Pure:
// text in, findings out. Everything it finds is a guess for the client to confirm; nothing here is a decision.
import { distance, rgbOf } from "./threads.ts";

export type SiteRead = { name: string | null; summary: string | null; colours: string[]; fonts: string[]; logo_urls: string[]; sheet_urls: string[] };

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/\s+/g, " ").trim();
const attr = (tag: string, name: string) => { const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i")); return m ? decode(m[2] ?? m[3] ?? m[4] ?? "") : null; };
const tags = (html: string, name: string) => html.match(new RegExp(`<${name}\\b[^>]*>`, "gi")) ?? [];
const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n).replace(/\s+\S*$/, "")}…`);

function absolute(url: string | null, base: string): string | null {
  if (!url || /^data:/i.test(url)) return null;
  try { const u = new URL(url, base); return u.protocol === "https:" ? u.href : null; } catch { return null; }
}

const GENERIC_FONTS = /^(inherit|initial|unset|serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-[a-z-]+|-apple-system|blinkmacsystemfont|segoe ui|roboto|helvetica neue|helvetica|arial|noto sans|apple color emoji|segoe ui emoji|segoe ui symbol|noto color emoji|times new roman|times|georgia|courier new|courier|var\(.*|font ?awesome.*|.*icons?|swiper.*|dashicons)$/i;

export function coloursIn(css: string): string[] {
  const seen = new Map<string, number>();
  const add = (hex: string, weight = 1) => seen.set(hex, (seen.get(hex) ?? 0) + weight);
  for (const m of css.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b(?![0-9a-f])/gi)) {
    const h = m[1]!.length === 3 ? [...m[1]!].map((c) => c + c).join("") : m[1]!;
    add(`#${h.toUpperCase()}`);
  }
  for (const m of css.matchAll(/rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:[\s,/]+([\d.]+%?))?\s*\)/g)) {
    if (m[4] !== undefined && parseFloat(m[4]) < (m[4].endsWith("%") ? 100 : 1)) continue;
    add(`#${[m[1], m[2], m[3]].map((n) => Math.min(255, Number(n)).toString(16).padStart(2, "0")).join("").toUpperCase()}`);
  }
  // Colour first: a brand's colours are the ones with some colour in them. Greys, black and white come last.
  const vivid = (hex: string) => { const [r, g, b] = rgbOf(hex); return Math.max(r, g, b) - Math.min(r, g, b); };
  const ranked = [...seen.entries()].map(([hex, n]) => ({ hex, n, colour: vivid(hex) > 24 })).sort((a, b) => Number(b.colour) - Number(a.colour) || b.n - a.n);
  const kept: string[] = [];
  for (const { hex } of ranked) {
    if (kept.every((k) => distance(rgbOf(k), rgbOf(hex)) > 40)) kept.push(hex);
    if (kept.length === 5) break;
  }
  return kept;
}

export function fontsIn(css: string): string[] {
  const seen = new Map<string, number>();
  for (const m of css.matchAll(/font-family\s*:\s*([^;}{]+)/gi)) {
    const first = m[1]!.split(",")[0]!.replace(/!important/i, "").replace(/["']/g, "").trim();
    if (first && first.length < 40 && !GENERIC_FONTS.test(first)) seen.set(first, (seen.get(first) ?? 0) + 1);
  }
  return [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([name]) => name);
}

export function readPage(html: string, baseUrl: string): SiteRead {
  const metas = tags(html, "meta");
  const meta = (key: string) => { const t = metas.find((m) => (attr(m, "property") ?? attr(m, "name") ?? "").toLowerCase() === key); return t ? attr(t, "content") : null; };
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
  const name = meta("og:site_name") ?? (title ? decode(title).split(/\s[|–—·-]\s/)[0]! : null);
  const summary = meta("og:description") ?? meta("description");
  const links = tags(html, "link");
  const rel = (l: string) => (attr(l, "rel") ?? "").toLowerCase();
  const logos = [
    ...tags(html, "img").filter((i) => /logo/i.test(`${attr(i, "src")} ${attr(i, "alt")} ${attr(i, "class")} ${attr(i, "id")}`)).map((i) => attr(i, "src")),
    ...links.filter((l) => /apple-touch-icon/.test(rel(l))).map((l) => attr(l, "href")),
    ...links.filter((l) => /\bicon\b/.test(rel(l))).map((l) => attr(l, "href")),
  ].map((u) => absolute(u, baseUrl)).filter((u): u is string => u !== null);
  const sheets = links.filter((l) => rel(l) === "stylesheet").map((l) => absolute(attr(l, "href"), baseUrl)).filter((u): u is string => u !== null);
  const inline = [...(html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) ?? []), ...(html.match(/\bstyle\s*=\s*"[^"]*"/gi) ?? [])].join("\n");
  const theme = meta("theme-color");
  return {
    name: name ? clip(name, 60) : null, summary: summary ? clip(summary, 240) : null,
    colours: coloursIn(`${theme && /^#[0-9a-f]{3,6}$/i.test(theme) ? `${theme};`.repeat(20) : ""}${inline}`), fonts: fontsIn(inline),
    logo_urls: [...new Set(logos)].slice(0, 3), sheet_urls: [...new Set(sheets)].slice(0, 3),
  };
}

// The page and its style sheets, read together.
export function readSite(html: string, sheets: string[], baseUrl: string): SiteRead {
  const page = readPage(html, baseUrl);
  const inline = [...(html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) ?? []), ...(html.match(/\bstyle\s*=\s*"[^"]*"/gi) ?? [])].join("\n");
  const theme = tags(html, "meta").map((m) => ((attr(m, "name") ?? "").toLowerCase() === "theme-color" ? attr(m, "content") : null)).find(Boolean);
  const css = `${theme && /^#[0-9a-f]{3,6}$/i.test(theme) ? `${theme};`.repeat(20) : ""}${inline}\n${sheets.join("\n")}`;
  return { ...page, colours: coloursIn(css), fonts: fontsIn(css) };
}

// What a person may type for their website: a plain public host name, with or without https:// and a path.
export function siteHost(typed: string): string | null {
  const t = typed.trim().toLowerCase().replace(/^https?:\/\//, "").split(/[/?#]/)[0]!;
  return /^(?=.{4,100}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(t) && !/\.(local|internal|localhost|lan|home|corp|test|example|invalid)$/.test(t) ? t : null;
}
