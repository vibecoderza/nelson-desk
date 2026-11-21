// The frame both surfaces sit in: a left rail and one working column. Screens that are not built yet are named
// and greyed, never linked: the rail shows where the Desk is going without a link to nowhere.
import type { ReactNode } from "react";

export type NavItem = { label: string; href?: string; count?: number; current?: boolean };

function Rail({ items }: { items: NavItem[] }) {
  return (
    <ul className="nav-list">
      {items.map((item) => (
        <li key={item.label}>
          {item.href ? (
            <a className="nav-link" href={item.href} aria-current={item.current ? "page" : undefined}>
              {item.label}
              {item.count != null && <span className="mono">{item.count}</span>}
            </a>
          ) : (
            <span className="nav-link is-later" title="Not built yet">{item.label}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function DeskShell({ current, openQuotes, children }: { current: "today" | "quotes"; openQuotes: number; children: ReactNode }) {
  const items: NavItem[] = [
    { label: "Today", href: "/", current: current === "today" },
    { label: "Inbox" },
    { label: "Quotes", href: "/quotes", count: openQuotes, current: current === "quotes" },
    { label: "Orders" }, { label: "Clients" }, { label: "Suppliers" }, { label: "Business" }, { label: "Settings" },
  ];
  return (
    <div className="app">
      <nav className="nav" aria-label="Desk">
        <a className="brand" href="/"><span className="wordmark">nelson</span><span className="label">Desk</span></a>
        <Rail items={items} />
        <div className="nav-foot">
          <div className="nav-card">
            <span className="label">Feeds</span>
            <span><i className="dot is-warn" />Nelson · stand-in, from fixtures</span>
            <span><i className="dot is-warn" />Quotes · stand-in book</span>
          </div>
        </div>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}

export function PortalShell({ current, clientName, openQuotes, contact, children }: { current: "home" | "quotes"; clientName: string; openQuotes: number; contact: string; children: ReactNode }) {
  const items: NavItem[] = [
    { label: "Home", href: "/", current: current === "home" },
    { label: "Quotes", href: "/quotes", count: openQuotes, current: current === "quotes" },
  ];
  return (
    <div className="app">
      <nav className="nav" aria-label="Portal">
        <a className="who brand" href="/">
          <span className="who-dot" aria-hidden="true" />
          <span><span className="who-name">{clientName}</span><br /><span className="small muted who-sub">Merch portal</span></span>
        </a>
        <Rail items={items} />
        <div className="nav-foot">
          <div className="nav-card is-well">
            <span className="label">Your contact</span>
            <span className="strong">{contact} at Nelson</span>
            <span className="muted">Replies within the working day</span>
          </div>
          <span className="small muted" style={{ padding: "0 8px" }}>Made by <span className="wordmark" style={{ fontSize: 16 }}>nelson</span></span>
        </div>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
