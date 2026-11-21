// Fetching a client's public website to read their brand from it. The address is one a person typed, so it is
// treated as hostile: https only, a public host name only, every hop checked against private address ranges, a
// short clock and a size cap. It reads; it never sends anything of ours.
import { lookup } from "node:dns/promises";
import { readPage, readSite, siteHost, type SiteRead } from "./read-site.ts";

export type SiteResult = { ok: true; host: string; read: SiteRead; logos: string[] } | { ok: false; code: "bad_address" | "unreachable" };

const PRIVATE_V4 = /^(0\.|10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|192\.0\.[02]\.|198\.1[89]\.|198\.51\.100\.|203\.0\.113\.|2(2[4-9]|[3-5]\d)\.)/;
const isPrivate = (ip: string, family: number) => family === 4 ? PRIVATE_V4.test(ip) : !/^[23][0-9a-f]{3}:/i.test(ip);

async function publicHost(host: string): Promise<boolean> {
  if (!siteHost(host)) return false;
  try {
    const found = await lookup(host, { all: true });
    return found.length > 0 && found.every((a) => !isPrivate(a.address, a.family));
  } catch { return false; }
}

async function get(url: string, accept: RegExp, maxBytes: number, hops = 3): Promise<{ bytes: Uint8Array; type: string; url: string } | null> {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== "https:" || u.port || u.username || !(await publicHost(u.hostname))) return null;
  let res: Response;
  try { res = await fetch(u, { redirect: "manual", signal: AbortSignal.timeout(5000), headers: { "user-agent": "Mozilla/5.0 (compatible; brand-reader)", accept: "text/html,text/css,image/*;q=0.8" } }); } catch { return null; }
  if (res.status >= 300 && res.status < 400) {
    const next = res.headers.get("location");
    return next && hops > 0 ? get(new URL(next, u).href, accept, maxBytes, hops - 1) : null;
  }
  const type = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  if (!res.ok || !accept.test(type) || !res.body) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      size += chunk.length;
      if (size > maxBytes) return null;
      chunks.push(chunk);
    }
  } catch { return null; }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { bytes.set(c, at); at += c.length; }
  return { bytes, type, url: u.href };
}

const text = (b: Uint8Array) => new TextDecoder("utf-8", { fatal: false }).decode(b);

export async function fetchSite(typed: string): Promise<SiteResult> {
  const host = siteHost(typed);
  if (!host) return { ok: false, code: "bad_address" };
  const page = await get(`https://${host}/`, /^text\/html$/, 1_500_000);
  if (!page) return { ok: false, code: "unreachable" };
  const html = text(page.bytes);
  const first = readPage(html, page.url);
  const sheets = (await Promise.all(first.sheet_urls.map((s) => get(s, /^text\/css$/, 1_000_000)))).filter((s) => s !== null).map((s) => text(s.bytes));
  const read = readSite(html, sheets, page.url);
  // Pictures are carried inside the page as data, never linked: the client's browser asks nobody else for anything.
  const pictures = await Promise.all(read.logo_urls.map((l) => get(l, /^image\/(png|jpeg|webp|gif|svg\+xml|x-icon|vnd\.microsoft\.icon)$/, 300_000)));
  const logos = pictures.filter((p) => p !== null).map((p) => `data:${p.type};base64,${Buffer.from(p.bytes).toString("base64")}`);
  return { ok: true, host, read, logos };
}
