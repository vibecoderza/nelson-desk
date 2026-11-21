// Business and Suppliers, drawn from their views. Desk only.
import { Chip } from "../ui/bits.tsx";
import { plural, rand } from "../ui/format.ts";
import type { Business } from "./business.ts";
import type { Suppliers } from "./suppliers.ts";

const whole = (cents: number | null) => rand(cents, { decimals: false });

export function BusinessScreen({ view }: { view: Business }) {
  const most = Math.max(1, ...view.by_month.map((m) => m.sales_cents));
  return (
    <div className="page is-calm is-wide">
      <header className="head"><h1>Business</h1></header>
      <section className="panel is-lead">
        <div className="hero">
          <div>
            <span className="hero-label">Sales in {view.month} · {plural(view.orders, "order")}</span>
            <b className="hero-total">{whole(view.sales_cents)}</b>
          </div>
        </div>
        <div className="facts is-four">
          <div><b>{whole(view.average_cents)}</b><span>average order</span></div>
          <div><b>{whole(view.open_cents)}</b><span>in open orders</span></div>
          <div><b>{whole(view.out_on_quote_cents)}</b><span>out on quote</span></div>
          <div><b>{view.decided ? `${view.won} of ${view.decided}` : "—"}</b><span>quotes won</span></div>
        </div>
      </section>
      <section className="group">
        <h2 className="group-title">By month</h2>
        <div className="panel"><div className="panel-body bars">
          {view.by_month.map((m) => <div key={m.month} className="bar is-money"><span>{m.month}</span><i style={{ width: `${(m.sales_cents / most) * 100}%` }} /><span className="mono">{whole(m.sales_cents)}</span></div>)}
        </div></div>
      </section>
      <section className="group">
        <h2 className="group-title">Paid orders</h2>
        <div className="list">
          {view.paid.map((o) => (
            <article key={o.ref} className="item">
              <a className="item-main" href={`/orders/${o.ref}`}><span className="item-title">{o.client}</span><span className="item-sub">{o.ref} · {o.what}</span></a>
              <span className="item-sub">Paid {o.on}</span>
              <span className="item-total">{whole(o.total_cents)}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export function SuppliersScreen({ view }: { view: Suppliers }) {
  return (
    <div className="page is-calm is-wide">
      <header className="head"><h1>Suppliers</h1></header>
      <section className="group">
        <h2 className="group-title">Costing requests</h2>
        <div className="list">
          {view.requests.map((r) => (
            <article key={r.id} className="item">
              <a className="item-main" href={`/quotes/${r.for_ref}`}><span className="item-title">{r.what}</span><span className="item-sub">{r.supplier} · for {r.for_ref} · sent {r.sent}</span></a>
              <Chip tone={r.chip.tone}>{r.chip.words}</Chip>
            </article>
          ))}
        </div>
      </section>
      <section className="group">
        <h2 className="group-title">Who makes it</h2>
        <div className="stack is-tight">
          {view.rows.map((s) => (
            <details key={s.name} className="more">
              <summary><span>{s.name} <span className="muted small">· {s.how}</span></span><span className="small muted">{s.with_them.length ? plural(s.with_them.length, "order") : ""}</span></summary>
              <div className="sums">
                {s.with_them.length === 0 && <div><span className="muted">Nothing with them now.</span><span /></div>}
                {s.with_them.map((o) => <div key={o.ref}><span><a href={`/orders/${o.ref}`}>{o.ref}</a> · {o.what} <span className="muted small">· {o.state}</span></span><span className="mono">{o.their_ref ?? "Not placed"}</span></div>)}
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
