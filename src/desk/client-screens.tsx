// The Desk's client screens. One client, everything of theirs, under plain headers.
import { Chip, Notice } from "../ui/bits.tsx";
import { dayTime, plural, rand } from "../ui/format.ts";
import type { ClientPage, Clients } from "./clients.ts";
import { OrderGroup } from "./order-screens.tsx";
import { Group, type PipelineActions } from "./screens.tsx";

type Action = (form: FormData) => Promise<void>;
type Said = { ok: boolean; text: string } | null;

export function ClientsScreen({ view }: { view: Clients }) {
  return (
    <div className="page is-calm is-wide">
      <header className="head"><h1>Clients</h1></header>
      <section className="list">
        {view.rows.map((c) => (
          <article key={c.id} className="item">
            <a className="item-main" href={`/clients/${c.id}`}>
              <span className="item-title">{c.name}</span>
              <span className="item-sub">{c.contact}</span>
            </a>
            <span className="chips">
              {c.open_orders > 0 && <Chip tone="ok">{plural(c.open_orders, "order")}</Chip>}
              {c.open_quotes > 0 && <Chip tone="warn">{plural(c.open_quotes, "quote")}</Chip>}
            </span>
            <span className="item-total">{c.paid_cents ? rand(c.paid_cents, { decimals: false }) : ""}</span>
            <a className="btn" href={`/clients/${c.id}`}>Open</a>
          </article>
        ))}
      </section>
    </div>
  );
}

export function ClientScreen({ view, said, actions }: { view: ClientPage; said: Said; actions: PipelineActions & { place: Action } }) {
  return (
    <div className="page is-calm is-wide">
      <header className="head">
        <a className="crumb" href="/clients">← Clients</a>
        <h1>{view.name}</h1>
      </header>
      <Notice notice={said} />
      <section className="panel is-lead hero">
        <div>
          <span className="hero-label">Paid to date · {plural(view.orders_count, "order")}</span>
          <b className="hero-total">{rand(view.paid_cents, { decimals: false })}</b>
        </div>
        <div className="hero-do">
          {view.open_quote_cents > 0 && <span className="small">Out on quote <b>{rand(view.open_quote_cents, { decimals: false })}</b></span>}
        </div>
      </section>
      {view.orders.length > 0 && <OrderGroup title="Orders" rows={view.orders} place={actions.place} />}
      {view.quotes.length > 0 && <Group title="Quotes" rows={view.quotes} actions={actions} />}
      <details className="more">
        <summary>Contact</summary>
        <div className="sums">
          <div><span>{view.contact}</span><span>{view.email}</span></div>
          <div><span>Delivers to</span><span>{view.address}</span></div>
        </div>
      </details>
      <details className="more">
        <summary>Numbers</summary>
        <div className="sums">
          <div><span>Average order</span><span className="mono">{rand(view.average_order_cents, { decimals: false })}</span></div>
          <div><span>Quotes won</span><span className="mono">{view.decided ? `${view.won} of ${view.decided}` : "—"}</span></div>
        </div>
      </details>
      <details className="more">
        <summary>Conversations{view.messages.length ? ` · ${view.messages.length}` : ""}</summary>
        <div className="stack is-tight">
          {view.messages.length === 0 && <span className="small muted">Nothing yet.</span>}
          {view.messages.map((m) => (
            <div key={m.on + m.at.toISOString()} className="say">
              <span className="small muted">{m.name} · {dayTime(m.at)} · {m.channel} · {m.on}</span>
              <span>{m.text}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
