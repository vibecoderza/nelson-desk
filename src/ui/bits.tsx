// Small drawn pieces both surfaces share. No data, no decisions.
import type { ReactNode } from "react";

export type Tone = "ok" | "warn" | "bad" | "ink" | "plain";

export function Chip({ tone = "plain", caps = false, children }: { tone?: Tone; caps?: boolean; children: ReactNode }) {
  return <span className={`chip${tone === "plain" ? "" : ` is-${tone}`}${caps ? " is-caps" : ""}`}>{children}</span>;
}

// The picture leads. A real mockup when there is one; a colour swatch until then.
export function Tile({ picture, colours, label, href }: { picture: string | null; colours: string[]; label: string; href?: string }) {
  const inside = picture ? <img src={picture} alt={label} loading="lazy" /> : colours.map((hex, i) => <i key={i} style={{ background: hex }} />);
  const cls = `tile${picture ? " has-picture" : ""}`;
  return href ? <a className={cls} href={href} aria-hidden="true" tabIndex={-1}>{inside}</a> : <div className={cls}>{inside}</div>;
}

export const Label = ({ children }: { children: ReactNode }) => <div className="label">{children}</div>;

export function Tabs({ tabs }: { tabs: { label: string; count: number; href: string; current: boolean }[] }) {
  return (
    <nav className="tabs" aria-label="Filter">
      {tabs.map((t) => (
        <a key={t.href} href={t.href} aria-current={t.current ? "page" : undefined}>
          <Chip>{t.label} · {t.count}</Chip>
        </a>
      ))}
    </nav>
  );
}

// What an action said back. Mock mode checks the rules and saves nothing, and says so.
export function Notice({ notice }: { notice: { ok: boolean; text: string } | null }) {
  if (!notice) return null;
  return <p className={`notice${notice.ok ? "" : " is-refused"}`} role="status">{notice.text}</p>;
}

export const MockBar = ({ children }: { children: ReactNode }) => <p className="mockbar"><span className="label" style={{ color: "inherit" }}>Mock data</span>{children}</p>;

export function readNotice(params: Record<string, string | string[] | undefined>): { ok: boolean; text: string } | null {
  const text = typeof params.said === "string" ? params.said : null;
  return text ? { ok: params.refused !== "1", text: text.slice(0, 400) } : null;
}
