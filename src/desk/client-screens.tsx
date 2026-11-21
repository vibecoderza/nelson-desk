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

export type ClientActions = PipelineActions & { place: Action; message: Action; sendQuote: Action };

// Two worlds on the left: orders, then quotes. On the right, who they are and the conversation, always open:
// the work happens here, the talking happens on WhatsApp, and both show on one page.
export function ClientScreen({ view, said, actions }: { view: ClientPage; said: Said; actions: ClientActions }) {
  const Id = () => <input type="hidden" name="client" value={view.id} />;
  return (
    <div className="page is-calm is-split">
      <header className="head">
        <a className="crumb" href="/clients">← Clients</a>
        <h1>{view.name}</h1>
      </header>
      <Notice notice={said} />
      <div className="cols">
        <div className="stack">
          {view.orders.length > 0 && <OrderGroup title="Orders" rows={view.orders} place={actions.place} />}
          {view.quotes.length > 0 && <Group title="Quotes" rows={view.quotes} actions={actions} />}
        </div>
        <aside className="side">
          <section className="panel">
            <div className="panel-body">
              <span className="strong">{view.contact}</span>
              <span className="small muted">{view.email} · WhatsApp ··· {view.phone_tail}</span>
              <span className="small muted">{view.address}</span>
            </div>
            <div className="facts">
              <div><b>{rand(view.paid_cents, { decimals: false })}</b><span>paid · {plural(view.orders_count, "order")}</span></div>
              <div><b>{rand(view.open_quote_cents, { decimals: false })}</b><span>out on quote</span></div>
              <div><b>{rand(view.average_order_cents, { decimals: false })}</b><span>average order</span></div>
              <div><b>{view.decided ? `${view.won} of ${view.decided}` : "—"}</b><span>quotes won</span></div>
            </div>
          </section>
          <section className="panel is-lead">
            <div className="panel-body">
              <span className="strong">Conversation</span>
              {view.messages.length === 0 && <span className="small muted">Nothing yet.</span>}
              <div className="thread">
                {view.messages.map((m) => (
                  <div key={m.on + m.at.toISOString()} className={`bubble${m.author === "nelson" ? " is-ours" : ""}`}>{m.text}<small>{m.name} · {dayTime(m.at)} · {m.channel} · <a href={`/${m.on.startsWith("N-") ? "orders" : "quotes"}/${m.on}`}>{m.on}</a></small></div>
                ))}
              </div>
            </div>
            <div className="panel-body">
              <form action={actions.message} className="reply"><Id /><input className="field" name="message" placeholder="Message on WhatsApp" aria-label={`Message ${view.contact}`} /><button className="btn">Send</button></form>
              {view.sendable.length > 0 && (
                <form action={actions.sendQuote} className="reply">
                  <Id />
                  <select className="field" name="ref" aria-label="Quote to send">{view.sendable.map((q) => <option key={q.ref} value={q.ref}>{q.ref} · {q.title}</option>)}</select>
                  <button className="btn">Send quote</button>
                </form>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
