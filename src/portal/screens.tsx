// The Portal's three quote screens, drawn from their views. Alan, 21 Nov 2026: a client must never face a
// spreadsheet. Simple rows, one next step, few words; the detail opens when it is asked for. Nothing here decides anything: what a client may do
// arrives in the view, and every button posts to an action that asks the rules again.
import type { ReactNode } from "react";
import { Chip, MockBar, Notice, Tabs, Tile } from "../ui/bits.tsx";
import { day, dayTime, rand } from "../ui/format.ts";
import type { QuoteDocument } from "../quotes/document.ts";
import { QuoteSheet } from "../quotes/sheet.tsx";
import { pickText, type PortalDecide, type PortalQuote, type PortalQuotes, type PortalRow, type PortalTab } from "./quotes.ts";

type Action = (form: FormData) => Promise<void>;
type Said = { ok: boolean; text: string } | null;
const TAB_WORDS: Record<PortalTab, string> = { open: "Open", accepted: "Accepted", closed: "Closed" };

function RowAction({ row, reopen }: { row: PortalRow; reopen: Action }) {
  const { kind, label } = row.action;
  if (kind === "open") return <a className="btn" href={`/quotes/${row.ref}`}>{label}</a>;
  if (kind === "decide") return <a className="btn is-next" href={`/quotes/${row.ref}/decide`}>{label}</a>;
  if (kind === "order") return <a className="btn" href={row.order_ref ? `/orders/${row.order_ref}` : `/quotes/${row.ref}`}>View order</a>;
  return <form action={reopen}><input type="hidden" name="ref" value={row.ref} /><button className="btn">{label}</button></form>;
}

// One quote, one row: what it is, what it costs, where it stands, the one thing to do next.
export function QuotesScreen({ view, said, reopen }: { view: PortalQuotes; said: Said; reopen: Action }) {
  return (
    <div className="page is-calm">
      <header className="head">
        <h1>Quotes</h1>
        <Tabs tabs={(Object.keys(TAB_WORDS) as PortalTab[]).map((t) => ({ label: TAB_WORDS[t], count: view.counts[t], href: t === "open" ? "/quotes" : `/quotes?tab=${t}`, current: t === view.tab }))} />
      </header>
      <Notice notice={said} />
      <section className="list">
        {view.rows.length === 0 && <p className="empty">Nothing here yet.</p>}
        {view.rows.map((row) => (
          <article key={row.ref} className="item has-tile">
            <Tile picture={row.picture} colours={row.tiles} label={row.title} href={`/quotes/${row.ref}`} />
            <a className="item-main" href={`/quotes/${row.ref}`}>
              <span className="item-title">{row.title}</span>
              <span className="item-sub">{row.ref}</span>
            </a>
            <Chip tone={row.chip.tone}>{row.chip.words}</Chip>
            <span className="item-total">{rand(row.total_cents)}</span>
            <RowAction row={row} reopen={reopen} />
          </article>
        ))}
      </section>
    </div>
  );
}

// The total and the next step lead. The lines are plain rows. Everything else opens when asked for.
export function QuoteScreen({ view, said, takeSuggestion, ask, askForPick }: { view: PortalQuote; said: Said; takeSuggestion: Action; ask: Action; askForPick: Action }) {
  const base = `/quotes/${view.ref}`;
  // Trying a quantity is a link: the pick rides in the address and nothing is saved until the client asks for it.
  const withPick = (id: string, n: number | null) => {
    const next = { ...view.pick };
    if (n === null) delete next[id]; else next[id] = n;
    const text = pickText(next);
    return `${text ? `${base}?pick=${text}` : base}#${id}`; // lands back on the same piece
  };
  const waiting = view.not_agreed === 1 ? "1 item is waiting on an answer." : `${view.not_agreed} items are waiting on an answer.`;
  return (
    <div className="page is-calm">
      <header className="head">
        <a className="crumb" href="/quotes">← Quotes</a>
        <h1>{view.title}</h1>
        <Chip tone={view.tone}>{view.state_word}</Chip>
      </header>
      <Notice notice={said} />
      {!view.is_current && <p className="notice">This is version {view.shown}, as it was sent. <a href={base}>See the latest</a></p>}

      <section className="panel is-lead hero">
        <div>
          <span className="hero-label">{view.picked ? "Your pick" : "Total"}</span>
          <b className="hero-total">{rand(view.totals.total_cents)}</b>
          <span className="small muted">Delivered. No VAT charged.</span>
        </div>
        <div className="hero-do">
          {view.picked ? (
            <form action={askForPick} className="hero-do">
              <input type="hidden" name="ref" value={view.ref} /><input type="hidden" name="pick" value={pickText(view.pick)} />
              <button className="btn is-big is-next">Ask Nelson for this</button>
              <a className="small" href={base}>Back to the quote as sent</a>
            </form>
          ) : view.order_ref ? <a className="btn is-big" href={`/orders/${view.order_ref}`}>View order {view.order_ref}</a>
            : view.can.acceptAndPay ? <a className="btn is-big is-next" href={`${base}/decide`}>Accept and pay</a>
            : view.can.decline ? <><span className="btn is-big is-off">Accept and pay</span><span className="small tone-warn">{waiting}</span></>
            : <span className="small muted">This quote is {view.state_word.toLowerCase()}.</span>}
        </div>
      </section>

      <section className="list">
        {view.lines.map((line) => (
          <article key={line.id} id={line.id} className={`item is-line${line.left_out ? " is-out" : ""}`}>
            <Tile picture={line.picture} colours={[line.colour_hex]} label={line.name} />
            <div className="item-main">
              <span className="item-title">{line.name}</span>
              <span className="item-sub">{line.left_out ? "Left out" : `${line.quantity} · ${line.colour}`}</span>
              {line.pickable && (
                <nav className="qty" aria-label={`Quantity of ${line.name}`}>
                  {line.breaks.map((b) => <a key={b.quantity} href={withPick(line.id, b.quantity)} aria-current={b.chosen ? "true" : undefined}>{b.quantity}</a>)}
                  {line.left_out ? null : <a className="qty-out" href={withPick(line.id, 0)}>Remove</a>}
                </nav>
              )}
            </div>
            <span className="item-total">{line.left_out ? "" : rand(line.line_total_cents)}</span>
            {line.tone !== "ok" && (
              <div className="item-note">
                <Chip tone={line.tone}>{line.state_word}</Chip>
                <span>{line.note}</span>
                {line.suggestion && (
                  <form action={takeSuggestion}>
                    <input type="hidden" name="ref" value={view.ref} /><input type="hidden" name="line" value={line.id} />
                    <button className="btn">Accept {line.suggestion}</button>
                  </form>
                )}
              </div>
            )}
          </article>
        ))}
      </section>

      <section className="panel" id="ask">
        <div className="panel-body">
          <span className="strong">Questions and changes</span>
          {view.messages.map((m) => (
            <div key={m.at.toISOString()} className="say">
              <span className="small muted">{m.author === "nelson" ? "Nelson" : m.name} · {dayTime(m.at)}</span>
              <span>{m.text}</span>
            </div>
          ))}
          {view.can.ask && (
            <form action={ask} className="reply">
              <input type="hidden" name="ref" value={view.ref} />
              <input className="field" name="message" placeholder="Ask a question or ask for a change" aria-label="Write to Nelson" />
              <button className="btn">Send</button>
            </form>
          )}
        </div>
      </section>

      <details className="more">
        <summary>Price breakdown</summary>
        <div className="sums">
          {view.lines.map((line) => <div key={line.id}><span>{line.name} <span className="muted small">· {line.quantity} × {rand(line.unit_cents)} · {line.decoration_words}</span></span><span className="mono">{rand(line.line_total_cents)}</span></div>)}
          <div><span>Setup</span><span className="mono">{rand(view.totals.setup_cents)}</span></div>
          <div><span>Delivery</span><span className="mono">{view.totals.delivery_cents ? rand(view.totals.delivery_cents) : "Included"}</span></div>
          <div className="is-total"><span>Total</span><span className="mono">{rand(view.totals.total_cents)}</span></div>
        </div>
        <p className="small muted">{view.terms}</p>
      </details>
      <details className="more">
        <summary>Versions{view.versions.length > 1 ? ` · ${view.versions.length}` : ""}</summary>
        <div className="stack is-tight">
          {view.versions.map((v) => (
            <a key={v.version} href={`${base}?v=${v.version}`} aria-current={v.shown ? "page" : undefined}>Version {v.version} · sent {v.sent}{v.shown ? " · showing" : ""}</a>
          ))}
          {view.changes.length > 0 && <p className="small muted">In version {view.shown}: {view.changes.join(". ")}</p>}
        </div>
      </details>
      <div className="links">
        <a href={`${base}/document?v=${view.shown}`}>Download the quote</a>
        {view.can.decline && <a href={`${base}/decide`}>Not going ahead?</a>}
      </div>
    </div>
  );
}

// One decision on the screen: pay. Declining sits one tap away, and still takes ten seconds.
export function DecideScreen({ view, said, accept, decline }: { view: PortalDecide; said: Said; accept: Action; decline: Action }) {
  const validTo = day(view.valid_until);
  return (
    <div className="page is-calm is-narrow">
      <header className="head">
        <a className="crumb" href={`/quotes/${view.ref}`}>← {view.title}</a>
      </header>
      <Notice notice={said} />
      <form action={accept} className="panel is-lead choice">
        <input type="hidden" name="ref" value={view.ref} />
        <div>
          <span className="hero-label">{view.summary}</span>
          <b className="hero-total">{rand(view.total_cents)}</b>
          <span className="small muted">No VAT charged. Valid to {validTo}.</span>
        </div>
        <div className="options" role="radiogroup" aria-label="How to pay">
          <label className="option"><input type="radio" name="method" value="card" defaultChecked /><b>Card</b>Pay now</label>
          <label className="option"><input type="radio" name="method" value="eft" /><b>EFT</b>Reference {view.ref}</label>
        </div>
        {view.can.acceptAndPay
          ? <button className="btn is-big is-next">{view.deposit ? "Accept and pay the deposit" : "Accept and pay"}</button>
          : <><span className="btn is-big is-off">Accept and pay</span><p className="small tone-warn">This unlocks when every item is agreed. <a href={`/quotes/${view.ref}`}>See what is waiting</a></p></>}
        <p className="small muted">You sign a proof before anything is made.</p>
      </form>
      {view.can.decline && (
        <details className="more">
          <summary>Not going ahead?</summary>
          <form action={decline} className="stack">
            <input type="hidden" name="ref" value={view.ref} />
            <div className="reasons" role="radiogroup" aria-label="Reason">
              {view.reasons.map((r) => <label key={r.value}><input type="radio" name="reason" value={r.value} />{r.words}</label>)}
            </div>
            <div className="budget">
              <span>Tell us the number you need to hit. We will try to get there.</span>
              <div className="budget-row">
                <input className="field" name="budget" inputMode="numeric" placeholder="My budget is R …" aria-label="Your budget in rand" />
                <button className="btn" name="intent" value="rework">Ask Nelson to re-work it</button>
              </div>
            </div>
            <textarea className="field" name="note" placeholder="Anything else? (optional)" aria-label="Anything else we should know?" />
            <button className="btn" name="intent" value="decline">Decline this quote</button>
            <span className="small muted">You can re-open it any time before {validTo}.</span>
          </form>
        </details>
      )}
    </div>
  );
}

export function DocumentScreen({ doc, printButton }: { doc: QuoteDocument; printButton: ReactNode }) {
  return (
    <div className="page">
      <header className="head">
        <a className="crumb" href={`/quotes/${doc.ref}`}>← {doc.ref}</a>
        <h1>Official quote <span>· v{doc.version}</span></h1>
        <div className="head-end">{printButton}</div>
      </header>
      <QuoteSheet doc={doc} />
    </div>
  );
}

export const PortalMockBar = () => <MockBar>Nothing is saved yet.</MockBar>;
