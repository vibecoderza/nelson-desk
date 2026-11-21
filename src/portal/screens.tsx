// The Portal's three quote screens, drawn from their views. Nothing here decides anything: what a client may do
// arrives in the view, and every button posts to an action that asks the rules again.
import type { ReactNode } from "react";
import { Chip, Label, MockBar, Notice, Tabs } from "../ui/bits.tsx";
import { day, dayTime, plural, rand } from "../ui/format.ts";
import type { QuoteDocument } from "../quotes/document.ts";
import { QuoteSheet } from "../quotes/sheet.tsx";
import type { PortalDecide, PortalQuote, PortalQuotes, PortalRow, PortalTab } from "./quotes.ts";

type Action = (form: FormData) => Promise<void>;
type Said = { ok: boolean; text: string } | null;
const TAB_WORDS: Record<PortalTab, string> = { open: "Open", accepted: "Accepted", closed: "Closed" };
const TAB_HINT: Record<PortalTab, string> = { open: "Newest change first", accepted: "Now in Orders", closed: "Declined or expired" };

function RowAction({ row, reopen }: { row: PortalRow; reopen: Action }) {
  const { kind, label } = row.action;
  if (kind === "open") return <a className="btn" href={`/quotes/${row.ref}`}>{label}</a>;
  if (kind === "decide") return <a className="btn is-next" href={`/quotes/${row.ref}/decide`}>{label}</a>;
  if (kind === "order") return <span className="btn is-off" title="Orders open in the next phase">{label}</span>;
  return <form action={reopen}><input type="hidden" name="ref" value={row.ref} /><button className="btn">{label}</button></form>;
}

export function QuotesScreen({ view, said, reopen }: { view: PortalQuotes; said: Said; reopen: Action }) {
  return (
    <div className="page">
      <header className="head">
        <h1>Quotes <span>· {view.counts.open} open</span></h1>
        <Tabs tabs={(Object.keys(TAB_WORDS) as PortalTab[]).map((t) => ({ label: TAB_WORDS[t], count: view.counts[t], href: t === "open" ? "/quotes" : `/quotes?tab=${t}`, current: t === view.tab }))} />
        <div className="head-end"><span className="btn is-off" title="New requests open with the customiser">+ New request</span></div>
      </header>
      <Notice notice={said} />
      <div className="cols">
        <section className="group">
          <div className="group-head"><span className="label"><b>{TAB_WORDS[view.tab]}</b></span><span className="label">{TAB_HINT[view.tab]}</span></div>
          {view.rows.length === 0 && <p className="empty">Nothing here yet.</p>}
          {view.rows.map((row) => (
            <article key={row.ref} className={`row is-quotes${row.tone === "plain" ? "" : ` is-${row.tone}`}`}>
              <a className="row-ref" href={`/quotes/${row.ref}`}>{row.ref}<small>{row.state_word}</small></a>
              <div><div className="row-title">{row.title}</div><div className="small muted">{row.changed}</div></div>
              <span className="mono small muted">v{row.version}</span>
              <span className="num">{rand(row.total_cents)}</span>
              <span><Chip tone={row.chip.tone}>{row.chip.words}</Chip></span>
              <div className="row-end"><RowAction row={row} reopen={reopen} /></div>
            </article>
          ))}
        </section>
        <aside className="side">
          <div className="panel is-lead">
            <div className="panel-body">
              <Label>How a quote works</Label>
              <ol className="stack is-tight" style={{ listStyle: "decimal", paddingLeft: 18 }}>
                <li><b>Working.</b> Change anything: quantity, colour, the logo in the customiser, add a product.</li>
                <li><b>Nelson answers.</b> We accept the change or offer the nearest thing we can make, and price it. That is a new version.</li>
                <li><b>Final.</b> Nothing is waiting. The lines are fixed.</li>
                <li><b>Accept and pay.</b> Online. It becomes an order.</li>
              </ol>
            </div>
            <div className="panel-body small muted">Every version is kept. You can always see what changed and who asked.</div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function QuoteScreen({ view, said, takeSuggestion, ask }: { view: PortalQuote; said: Said; takeSuggestion: Action; ask: Action }) {
  const base = `/quotes/${view.ref}`;
  const before = view.versions.filter((v) => v.version < view.shown).at(-1);
  return (
    <div className="page">
      <header className="head">
        <h1>{view.ref} <span>· {view.title}</span></h1>
        <Chip tone={view.tone} caps>{view.state_word}</Chip>
        <div className="head-end">
          <span className="label">Version</span>
          <nav className="tabs" aria-label="Version">
            {view.versions.map((v) => (
              <a key={v.version} href={`${base}?v=${v.version}`} aria-current={v.shown ? "page" : undefined}><Chip>v{v.version} · {v.sent}</Chip></a>
            ))}
          </nav>
        </div>
      </header>
      <Notice notice={said} />
      {!view.is_current && <p className="notice">You are looking at v{view.shown}, as it was sent. <a href={base}>Back to the latest version</a></p>}
      <section className="panel strip">
        <span className="label"><b>What changed in v{view.shown}</b></span>
        {view.changes.map((c) => <span key={c}>{c}</span>)}
        {before && <a className="strip-end small" href={`${base}?v=${before.version}`}>Compare with v{before.version}</a>}
      </section>
      <div className="cols">
        <section className="stack is-tight">
          {view.lines.map((line) => (
            <article key={line.id} className="panel line">
              <div className="tile" title="Your mockup shows here once the customiser publishes it"><i style={{ background: line.colour_hex }} /></div>
              <div className="stack is-tight">
                <div><div className="row-title">{line.name} · {line.colour}</div><div className="small muted">{line.decoration_words}</div></div>
                {view.can.change && (
                  <div className="links">
                    <span className="muted" title="Opens with the customiser">Edit in customiser</span>
                    <span className="muted" title="Opens with the customiser">Quantity</span>
                    <a href="#ask">Ask</a>
                  </div>
                )}
              </div>
              <div className="breaks" aria-label="Quantity breaks">
                {line.breaks.map((b) => <Chip key={b.quantity} tone={b.chosen ? "ink" : "plain"}>{b.quantity}</Chip>)}
                {line.breaks.length === 0 && <Chip tone="ink">{line.quantity}</Chip>}
              </div>
              <div className="line-money"><b>{rand(line.line_total_cents)}</b><span>{line.quantity} × {rand(line.unit_cents)}</span></div>
              <div className="line-state">
                <Chip tone={line.tone} caps>{line.state_word}</Chip>
                <span>{line.note}</span>
                {line.suggestion && (
                  <form action={takeSuggestion} className="actions">
                    <input type="hidden" name="ref" value={view.ref} /><input type="hidden" name="line" value={line.id} />
                    <button className="btn">Accept {line.suggestion}</button>
                    <span className="btn is-off" title="Opens with the customiser">Edit it</span>
                  </form>
                )}
              </div>
            </article>
          ))}
          {view.can.change && (
            <div className="actions">
              <span className="btn is-off" title="Opens with the customiser">+ Add a product</span>
              <span className="btn is-off" title="Opens with the mockup shop">Add from mockup shop</span>
            </div>
          )}
        </section>
        <aside className="side">
          <div className="panel is-lead">
            <div className="panel-body">
              <Label>Total · version {view.shown}</Label>
              <div className="sums">
                <div><span>{plural(view.lines.length, "line")}</span><span className="mono">{rand(view.totals.lines_cents)}</span></div>
                <div><span>Setup</span><span className="mono">{rand(view.totals.setup_cents)}</span></div>
                <div><span>Delivery <span className="muted small">· {view.delivery_words}</span></span><span className="mono">{view.totals.delivery_cents ? rand(view.totals.delivery_cents) : "Included"}</span></div>
                <div className="is-total"><span>Total</span><span className="mono">{rand(view.totals.total_cents)}</span></div>
              </div>
              <span className="small muted">No VAT charged.</span>
            </div>
            <div className="panel-body">
              {view.order_ref ? <p className="small">Paid. This quote is now order {view.order_ref}.</p>
                : view.can.acceptAndPay ? <a className="btn is-big is-next" href={`${base}/decide`}>Accept v{view.shown} and pay</a>
                : view.can.decline ? (
                  <>
                    <p className="small tone-warn">{view.not_agreed === 1 ? "1 line is waiting." : `${view.not_agreed} lines are waiting.`} You can accept and pay once each one reads Agreed.</p>
                    <span className="btn is-big is-off">Accept v{view.shown} and pay</span>
                  </>
                ) : <p className="small muted">This quote is {view.state_word.toLowerCase()}.</p>}
              <span className="small muted">{view.terms}</span>
              <div className="links">
                <a href={`${base}/document?v=${view.shown}`}>Official quote (PDF)</a>
                {view.can.decline && <a href={`${base}/decide`}>Not going ahead?</a>}
              </div>
            </div>
          </div>
          <div className="panel" id="ask">
            <div className="panel-body">
              <Label>Discussion · on this quote</Label>
              {view.messages.length === 0 && <span className="small muted">No messages yet.</span>}
              {view.messages.map((m) => (
                <div key={m.at.toISOString()} className="say">
                  <span className="label">{m.author === "nelson" ? "Nelson" : m.name} · {dayTime(m.at)}{m.tag ? ` · ${m.tag}` : ""}</span>
                  <span>{m.text}</span>
                </div>
              ))}
              {view.can.ask && (
                <form action={ask} className="reply">
                  <input type="hidden" name="ref" value={view.ref} />
                  <input className="field" name="message" placeholder="Write to Nelson…" aria-label="Write to Nelson" />
                  <button className="btn">Send</button>
                </form>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function DecideScreen({ view, said, accept, decline }: { view: PortalDecide; said: Said; accept: Action; decline: Action }) {
  const validTo = day(view.valid_until);
  return (
    <div className="page">
      <header className="head">
        <a className="crumb" href={`/quotes/${view.ref}`}>← {view.ref}</a>
        <h1>{view.title} <span>· v{view.version}</span></h1>
        {view.can.acceptAndPay ? <Chip tone="ok" caps>Ready to accept</Chip> : <Chip tone="warn" caps>Not final yet</Chip>}
        <div className="head-end"><span className="mono small muted">valid to {validTo}</span></div>
      </header>
      <Notice notice={said} />
      <div className="cols is-even">
        <form action={accept} className="panel is-lead choice">
          <input type="hidden" name="ref" value={view.ref} />
          <div><Label>Going ahead</Label><h2>Accept and pay</h2></div>
          <div className="amount"><span>{view.summary}</span><b>{rand(view.total_cents)}</b></div>
          <div className="options" role="radiogroup" aria-label="How to pay">
            <label className="option"><input type="radio" name="method" value="card" defaultChecked /><b>Card</b>Pay now. The order starts at once.</label>
            <label className="option"><input type="radio" name="method" value="eft" /><b>EFT</b>Use {view.ref} as the reference.</label>
          </div>
          {view.can.acceptAndPay
            ? <button className="btn is-big is-next">{view.deposit ? "Accept and pay the deposit" : `Accept and pay ${rand(view.total_cents)}`}</button>
            : <><span className="btn is-big is-off">Accept and pay</span><p className="small tone-warn">A line is still waiting. Accept and pay unlocks when every line reads Agreed. <a href={`/quotes/${view.ref}`}>See the lines</a></p></>}
          <p className="small muted">It becomes an order with a target delivery date. You get a proof to sign first, and nothing is made until you sign it. No VAT charged.</p>
          <div className="links">
            <a href={`/quotes/${view.ref}/document`}>Download the official quote (PDF)</a>
            <a href={`/quotes/${view.ref}#ask`}>Ask a question</a>
            <a href={`/quotes/${view.ref}`}>Change something</a>
          </div>
        </form>
        {view.can.decline ? (
          <form action={decline} className="panel choice">
            <input type="hidden" name="ref" value={view.ref} />
            <div><Label>Not going ahead</Label><h2>Tell us why. It takes ten seconds.</h2></div>
            <div className="reasons" role="radiogroup" aria-label="Reason">
              {view.reasons.map((r) => <label key={r.value}><input type="radio" name="reason" value={r.value} />{r.words}</label>)}
            </div>
            <div className="budget">
              <span><b>Too expensive?</b> Tell us the number you need to hit. We may be able to change the quantity, the method or the product to get there.</span>
              <div className="budget-row">
                <input className="field" name="budget" inputMode="numeric" placeholder="My budget is R …" aria-label="Your budget in rand" />
                <button className="btn" name="intent" value="rework">Ask Nelson to re-work it</button>
              </div>
            </div>
            <textarea className="field" name="note" placeholder="Anything else we should know? (optional)" aria-label="Anything else we should know?" />
            <button className="btn is-big" name="intent" value="decline">Decline this quote</button>
            <p className="small muted">Your designs stay in your store. You can re-open this quote any time before {validTo}.</p>
          </form>
        ) : <div className="panel choice"><Label>Not going ahead</Label><p className="muted">This quote is already closed.</p></div>}
      </div>
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

export const PortalMockBar = () => <MockBar>These are sample quotes. Buttons check the rules and save nothing yet.</MockBar>;
