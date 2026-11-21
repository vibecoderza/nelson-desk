// The Portal's home, order and proof screens, drawn from their views. Same rule as the quote screens: the picture
// leads, one next step, few words, the detail opens when it is asked for. Nothing here decides anything.
import { Chip, Notice, Steps, Tabs, Tile } from "../ui/bits.tsx";
import { dayTime, rand } from "../ui/format.ts";
import type { HomeRow, PortalHome, PortalOrder, PortalOrders, PortalOrderTab, PortalProof } from "./orders.ts";

type Action = (form: FormData) => Promise<void>;
type Said = { ok: boolean; text: string } | null;

const HomeGroup = ({ title, rows, empty }: { title: string; rows: HomeRow[]; empty: string }) => (
  <section className="group">
    <h2 className="group-title">{title}</h2>
    {rows.length === 0 ? <p className="empty">{empty}</p> : (
      <div className="list">
        {rows.map((row) => (
          <article key={row.key} className="item has-tile">
            <Tile picture={row.picture} colours={row.tiles} label={row.title} href={row.href} />
            <a className="item-main" href={row.href}>
              <span className="item-title">{row.title}</span>
              <span className="item-sub">{row.sub}</span>
            </a>
            <Chip tone={row.chip.tone}>{row.chip.words}</Chip>
            <a className={`btn${row.next ? " is-next" : ""}`} href={row.next?.href ?? row.href}>{row.next?.label ?? "View"}</a>
          </article>
        ))}
      </div>
    )}
  </section>
);

export function HomeScreen({ view, said }: { view: PortalHome; said: Said }) {
  return (
    <div className="page is-calm">
      <header className="head"><h1>Home</h1></header>
      <Notice notice={said} />
      <HomeGroup title="Needs you" rows={view.needs} empty="Nothing needs you." />
      <HomeGroup title="On its way" rows={view.moving} empty="Nothing in the works." />
    </div>
  );
}

const TAB_WORDS: Record<PortalOrderTab, string> = { open: "Open", done: "Delivered" };

export function OrdersScreen({ view, said }: { view: PortalOrders; said: Said }) {
  return (
    <div className="page is-calm">
      <header className="head">
        <h1>Orders</h1>
        <Tabs tabs={(Object.keys(TAB_WORDS) as PortalOrderTab[]).map((t) => ({ label: TAB_WORDS[t], count: view.counts[t], href: t === "open" ? "/orders" : `/orders?tab=${t}`, current: t === view.tab }))} />
      </header>
      <Notice notice={said} />
      <section className="list">
        {view.rows.length === 0 && <p className="empty">Nothing here yet.</p>}
        {view.rows.map((row) => (
          <article key={row.ref} className="item has-tile">
            <Tile picture={row.picture} colours={row.tiles} label={row.title} href={`/orders/${row.ref}`} />
            <a className="item-main" href={`/orders/${row.ref}`}>
              <span className="item-title">{row.title}</span>
              <span className="item-sub">{row.ref} · {row.when}</span>
            </a>
            <Chip tone={row.chip.tone}>{row.chip.words}</Chip>
            <a className={`btn${row.next ? " is-next" : ""}`} href={row.next?.href ?? `/orders/${row.ref}`}>{row.next?.label ?? "View"}</a>
          </article>
        ))}
      </section>
    </div>
  );
}

// When it arrives and the one thing to do lead. The steps say where it is. The rest opens when asked for.
export function OrderScreen({ view, said, ask }: { view: PortalOrder; said: Said; ask: Action }) {
  const base = `/orders/${view.ref}`;
  return (
    <div className="page is-calm">
      <header className="head">
        <a className="crumb" href="/orders">← Orders</a>
        <h1>{view.title}</h1>
        <Chip tone={view.chip.tone}>{view.chip.words}</Chip>
      </header>
      <Notice notice={said} />

      <section className="panel is-lead hero">
        <div>
          <span className="hero-label">{view.lead.label}</span>
          <b className="hero-total">{view.lead.words}</b>
          {view.lead.note && <span className="small muted">{view.lead.note}</span>}
        </div>
        <div className="hero-do">
          {view.next ? <a className="btn is-big is-next" href={view.next.href}>{view.next.label}</a>
            : view.tracking && view.state === "dispatched" ? <span className="small">Waybill <b className="mono">{view.tracking.waybill}</b></span>
            : null}
        </div>
      </section>
      <Steps steps={view.steps} />

      <section className="list">
        {view.lines.map((line) => (
          <article key={line.id} className="item is-line">
            <Tile picture={line.picture} colours={[line.colour_hex]} label={line.name} />
            <div className="item-main">
              <span className="item-title">{line.name}</span>
              <span className="item-sub">{line.quantity} · {line.colour}</span>
              <span className="item-sub">{line.decoration_words}</span>
            </div>
          </article>
        ))}
      </section>

      {view.can_ask && (
        <section className="panel" id="ask">
          <div className="panel-body">
            <span className="strong">Questions</span>
            {view.messages.map((m) => (
              <div key={m.at.toISOString()} className="say">
                <span className="small muted">{m.author === "nelson" ? "Nelson" : m.name} · {dayTime(m.at)}</span>
                <span>{m.text}</span>
              </div>
            ))}
            <form action={ask} className="reply">
              <input type="hidden" name="ref" value={view.ref} />
              <input className="field" name="message" placeholder="Ask about this order" aria-label="Write to Nelson" />
              <button className="btn">Send</button>
            </form>
          </div>
        </section>
      )}

      {view.tracking && (
        <details className="more" open={view.state === "dispatched"}>
          <summary>Tracking</summary>
          <div className="sums">
            {view.tracking.steps.map((s) => <div key={s.at.toISOString()}><span>{s.words}</span><span className="small muted">{dayTime(s.at)}</span></div>)}
          </div>
          <p className="small muted">{view.tracking.service} · waybill {view.tracking.waybill}</p>
        </details>
      )}
      <details className="more">
        <summary>Timeline</summary>
        <div className="sums">
          {view.log.map((e) => <div key={e.at.toISOString() + e.words}><span>{e.words}</span><span className="small muted">{dayTime(e.at)}</span></div>)}
        </div>
      </details>
      <details className="more">
        <summary>Payment</summary>
        <div className="sums">
          <div className="is-total"><span>Paid {view.paid}</span><span className="mono">{rand(view.total_cents)}</span></div>
        </div>
        <p className="small muted">No VAT charged.</p>
      </details>
      <div className="links">
        {view.proof_signed && <a href={`${base}/proof`}>See the signed proof</a>}
        {view.quote_ref && <a href={`/quotes/${view.quote_ref}`}>See the quote</a>}
      </div>
    </div>
  );
}

// One job on this screen: look at the sheet, tick four things, sign. Nothing is made unsigned.
export function ProofScreen({ view, said, sign, askChange }: { view: PortalProof; said: Said; sign: Action; askChange: Action }) {
  return (
    <div className="page is-calm is-narrow">
      <header className="head">
        <a className="crumb" href={`/orders/${view.order_ref}`}>← {view.title}</a>
        <h1>{view.signed ? "Signed proof" : "Sign your proof"}</h1>
      </header>
      <Notice notice={said} />
      <section className="panel proof-sheet">
        {view.sheet_picture ? <img src={view.sheet_picture} alt={`Proof for ${view.title}`} /> : <p className="empty">The proof sheet opens here.</p>}
        <div className="panel-body">
          {view.lines.map((l) => (
            <div key={l.name} className="say"><span className="strong">{l.name}</span><span className="small muted">{l.quantity} · {l.colour} · {l.decoration_words}</span></div>
          ))}
        </div>
      </section>

      {view.signed ? (
        <p className="notice">Signed by {view.signed.name} on {view.signed.on}. The design is locked.</p>
      ) : view.can_sign && view.may_sign ? (
        <form action={sign} className="panel is-lead choice">
          <input type="hidden" name="ref" value={view.order_ref} /><input type="hidden" name="sheet" value={view.sheet_sha256 ?? ""} />
          <div className="ticks">
            {view.checks.map((c) => <label key={c.value}><input type="checkbox" name={c.value} />{c.words}</label>)}
          </div>
          <input className="field" name="name" placeholder="Your full name" aria-label="Your full name" autoComplete="name" />
          <input className="field is-signature" name="signature" placeholder="Type your signature" aria-label="Your signature" />
          <button className="btn is-big is-next">Sign and send to production</button>
          <p className="small muted">{view.statement} Sign today and it arrives {view.arriving}.</p>
        </form>
      ) : (
        <p className="notice">{view.can_sign ? "Only an Owner on your account can sign a proof." : "This proof is not waiting on a signature."}</p>
      )}

      {view.can_sign && (
        <details className="more">
          <summary>Something is not right?</summary>
          <form action={askChange} className="stack">
            <input type="hidden" name="ref" value={view.order_ref} />
            <textarea className="field" name="note" placeholder="Tell us what to change" aria-label="What to change" />
            <button className="btn">Ask for a change</button>
            <span className="small muted">We send a new proof. The arrival date moves with it.</span>
          </form>
        </details>
      )}
    </div>
  );
}
