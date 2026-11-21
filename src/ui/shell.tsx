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

export type DeskPlace = "today" | "quotes" | "orders" | "clients";
export type PortalPlace = "home" | "quotes" | "orders";

export function DeskShell({ current, openQuotes, openOrders, children }: { current: DeskPlace; openQuotes: number; openOrders: number; children: ReactNode }) {
  const items: NavItem[] = [
    { label: "Today", href: "/", current: current === "today" },
    { label: "Quotes", href: "/quotes", count: openQuotes, current: current === "quotes" },
    { label: "Orders", href: "/orders", count: openOrders, current: current === "orders" },
    { label: "Clients", href: "/clients", current: current === "clients" },
  ];
  return (
    <div className="app">
      <nav className="nav" aria-label="Desk">
        <a className="brand" href="/"><span className="wordmark">nelson</span><span className="label">Desk</span></a>
        <Rail items={items} />
        <div className="nav-foot"><span className="small muted" style={{ padding: "0 8px" }}>Sample data</span></div>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}

export function PortalShell({ current, clientName, openQuotes, openOrders, contact, children }: { current: PortalPlace; clientName: string; openQuotes: number; openOrders: number; contact: string; children: ReactNode }) {
  const items: NavItem[] = [
    { label: "Home", href: "/", current: current === "home" },
    { label: "Quotes", href: "/quotes", count: openQuotes, current: current === "quotes" },
    { label: "Orders", href: "/orders", count: openOrders, current: current === "orders" },
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
          </div>
          <span className="small muted" style={{ padding: "0 8px" }}>Made by <span className="wordmark" style={{ fontSize: 16 }}>nelson</span></span>
        </div>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
