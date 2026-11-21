// The Desk's three quote screens, drawn from their views. Desk only: the builder shows supplier, cost, mark-up
// and margin. Rendered on the server, never shipped as code.
import type { ReactNode } from "react";
import { Chip, Label, Notice, Tabs } from "../ui/bits.tsx";
import { count, day, dayTime, plural, rand } from "../ui/format.ts";
import type { QuoteDocument } from "../quotes/document.ts";
import { QuoteSheet } from "../quotes/sheet.tsx";
import { QUOTE_SETTINGS } from "../quotes/settings.ts";
import type { Builder, Pipeline, PipelineRow, PipelineTab } from "./quotes.ts";

type Action = (form: FormData) => Promise<void>;
type Said = { ok: boolean; text: string } | null;
export type PipelineActions = { followUp: Action; rework: Action };
export type BuilderActions = { answer: Action; send: Action; reply: Action };

const TAB_WORDS: Record<PipelineTab, string> = { open: "Open", accepted: "Accepted", declined: "Declined", expired: "Expired" };
const decimal = (n: number) => String(n).replace(".", ",");

function RowAction({ row, actions }: { row: PipelineRow; actions: PipelineActions }) {
  const { kind, label, next } = row.action;
  if (kind === "open") return <a className="btn" href={`/quotes/${row.ref}`}>{label}</a>;
  if (kind === "order") return <span className="btn is-off" title="Orders open in the next phase">{label}</span>;
  const follow = kind === "send_check_in" ? "check_in" : kind === "send_video_ask" ? "video_ask" : kind === "last_ask" ? "last_ask" : null;
  return (
    <form action={follow ? actions.followUp : actions.rework}>
      <input type="hidden" name="ref" value={row.ref} /><input type="hidden" name="from" value="pipeline" />
      {follow && <input type="hidden" name="kind" value={follow} />}
      <button className={`btn${next ? " is-next" : ""}`}>{label}</button>
    </form>
  );
}

const Row = ({ row, actions }: { row: PipelineRow; actions: PipelineActions }) => (
  <article className={`row is-pipeline${row.tone === "plain" ? "" : ` is-${row.tone}`}`}>
    <a className="row-ref" href={`/quotes/${row.ref}`}>{row.ref}</a>
    <div><div className="row-title">{row.client}</div><div className="small muted">{row.what}</div></div>
    <span className="num">{rand(row.total_cents, { decimals: false })}</span>
    <span className="small">{row.seen}</span>
    <span><Chip tone={row.chip.tone}>{row.chip.words}</Chip></span>
    <div className="row-end"><RowAction row={row} actions={actions} /></div>
  </article>
);

export function PipelineScreen({ view, said, actions }: { view: Pipeline; said: Said; actions: PipelineActions }) {
  const s = QUOTE_SETTINGS.followUps;
  const most = Math.max(1, ...view.lost.map((l) => l.count));
  return (
    <div className="page">
      <header className="head">
        <h1>Quotes <span>· {view.counts.open} open{view.overdue ? ` · ${plural(view.overdue, "follow-up")} overdue` : ""}</span></h1>
        <Tabs tabs={(Object.keys(TAB_WORDS) as PipelineTab[]).map((t) => ({ label: TAB_WORDS[t], count: view.counts[t], href: t === "open" ? "/quotes" : `/quotes?tab=${t}`, current: t === view.tab }))} />
        <div className="head-end"><span className="btn is-off" title="New quotes start from the Inbox, which is next">+ New quote</span></div>
      </header>
      <Notice notice={said} />
      <div className="cols">
        <div className="stack">
          {view.tab === "open" ? view.groups.map((g) => (
            <section key={g.key} className="group">
              <div className="group-head"><span className="label"><b>{g.title}</b></span>{g.hint && <span className="label">{g.hint}</span>}</div>
              {g.rows.map((row) => <Row key={row.ref} row={row} actions={actions} />)}
            </section>
          )) : (
            <section className="group">
              <div className="group-head"><span className="label"><b>{TAB_WORDS[view.tab]}</b></span><span className="label">Newest first</span></div>
              {view.flat.length === 0 && <p className="empty">Nothing here.</p>}
              {view.flat.map((row) => <Row key={row.ref} row={row} actions={actions} />)}
            </section>
          )}
        </div>
        <aside className="side">
          <div className="panel is-lead">
            <div className="panel-body">
              <Label>So far</Label>
              <div className="stats">
                <div className="stat"><b>{view.month.win_pct === null ? "—" : `${view.month.win_pct}%`}</b><span>won · {view.month.won} of {view.month.decided}</span></div>
                <div className="stat"><b>{view.month.hours_to_first_quote === null ? "—" : `${decimal(view.month.hours_to_first_quote)} h`}</b><span>to first quote</span></div>
                <div className="stat"><b>{view.month.days_to_decision === null ? "—" : `${decimal(view.month.days_to_decision)} d`}</b><span>to a decision</span></div>
              </div>
            </div>
            <div className="panel-body">
              <Label>Why we lose</Label>
              <div className="bars">
                {view.lost.map((l) => <div key={l.words} className="bar"><span>{l.words}</span><i style={{ width: `${(l.count / most) * 100}%` }} /><span className="mono">{l.count}</span></div>)}
              </div>
              <span className="small muted">Every decline carries a reason. “No reply” is a quote that expired at day {s.closeDay}.</span>
            </div>
          </div>
          <div className="panel">
            <div className="panel-body">
              <Label>Follow-up rules</Label>
              <div className="stack is-tight small">
                <span>Day {s.checkInDay} · check-in</span>
                <span>Day {s.videoDay} · your video, with Accept and Not going ahead</span>
                <span>Day {s.closeDay} · quote closes as “No reply”</span>
                <span className="muted">A follow-up is due on its day and overdue the day after. The clock stops while a client’s change waits on us. Every one waits for your send.</span>
              </div>
            </div>
            <div className="panel-body">
              <Label>What “seen” means</Label>
              <div className="stack is-tight small">
                <span>Opened: the client opened the portal page.</span>
                <span>Video watched: they played your recording.</span>
                <span className="muted">Both come from the portal, never from email tracking.</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function stockTone(stock: number, quantity: number) { return stock === 0 ? "tone-bad" : stock < quantity ? "tone-warn" : "tone-ok"; }

export function BuilderScreen({ view, said, actions }: { view: Builder; said: Said; actions: BuilderActions }) {
  const stateTone = view.state === "final" || view.state === "accepted" ? "ok" : view.state === "working" ? "warn" : view.state === "declined" ? "bad" : "plain";
  const Ref = () => <input type="hidden" name="ref" value={view.ref} />;
  return (
    <div className="page">
      <header className="head">
        <a className="crumb" href="/quotes">← Quotes</a>
        <h1>{view.ref} <span>· {view.client.name} · {view.title}</span></h1>
        <Chip tone={stateTone} caps>{view.version ? `v${view.version} · ` : ""}{view.state_word}</Chip>
        <div className="head-end">
          <a className="btn" href={`/quotes/${view.ref}`} title="Asks Nelson again">Refresh stock</a>
          {view.version > 0 && <a className="btn" href={`/quotes/${view.ref}/pdf`}>Official quote PDF</a>}
          {view.can_send && <form action={actions.send}><Ref /><button className="btn is-next">Send v{view.next_version}</button></form>}
        </div>
      </header>
      <Notice notice={said} />
      {!view.nelson.ok && <p className="mockbar"><span className="label" style={{ color: "inherit" }}>Nelson</span>{view.nelson.words}</p>}
      <section className="panel table-wrap">
        <table className="lines">
          <thead>
            <tr>
              <th>Line</th><th>Supplier</th><th className="num">Stock</th><th className="num">Cost</th><th className="num">Branding</th>
              <th className="num">Qty</th><th className="num">Mark-up</th><th className="num">Sell each</th><th className="num">Line</th><th className="num">Margin</th><th>State</th>
            </tr>
          </thead>
          <tbody>
            {view.lines.map((l) => (
              <tr key={l.id}>
                <td><b>{l.name} · {l.colour}</b><small className="mono">{l.product_code}</small><small>{l.decoration_words}</small></td>
                <td>{l.staff ? <>{l.staff.supplier}<small className="mono">{l.staff.supplier_code}</small></> : <span className="muted">—</span>}</td>
                <td className="num">{l.staff ? <><span className={stockTone(l.staff.stock, l.quantity)}>{count(l.staff.stock)}</span>{l.staff.incoming_stock[0] && <small>+{count(l.staff.incoming_stock[0].quantity)} · {day(l.staff.incoming_stock[0].due)}</small>}</> : "—"}</td>
                <td className="num">{rand(l.staff?.unit_cost_cents)}</td>
                <td className="num">{rand(l.staff?.branding_cost_cents)}</td>
                <td className="num">{count(l.quantity)}</td>
                <td className="num" title="Nelson’s rule. Read-only on the Desk.">{l.staff ? `${decimal(l.staff.markup_applied_pct)}%` : "—"}</td>
                <td className="num"><b>{rand(l.unit_cents)}</b>{l.price === "frozen" && <small>as sent</small>}</td>
                <td className="num">{rand(l.line_total_cents)}</td>
                <td className="num">{l.staff ? <><span className="tone-ok">{rand(l.staff.margin_cents, { decimals: false })}</span><small>{decimal(l.staff.margin_pct)}%</small></> : "—"}</td>
                <td><Chip tone={l.tone}>{l.state_word}</Chip></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="totalbar">
        <div><Label>Cost</Label><b>{rand(view.staff_totals?.cost_cents, { decimals: false })}</b></div>
        <div><Label>Setup and freight</Label><b>{view.totals ? `${rand(view.totals.setup_cents, { decimals: false })} · ${rand(view.totals.delivery_cents, { decimals: false })}` : "—"}</b></div>
        <div><Label>Sell</Label><b>{rand(view.totals?.total_cents, { decimals: false })}</b></div>
        <div><Label>Margin</Label><b className="tone-ok">{view.staff_totals ? `${rand(view.staff_totals.margin_cents, { decimals: false })} · ${decimal(view.staff_totals.margin_pct)}%` : "—"}</b></div>
        <div><Label>Waiting on</Label><b className={view.waiting.tone === "plain" ? "" : `tone-${view.waiting.tone}`} style={{ fontFamily: "inherit", fontSize: 15 }}>{view.waiting.words}</b></div>
      </section>
      <div className="cols">
        <div className="stack">
          <>
            <section className="panel">
              <div className="panel-body">
                <Label>Client changes to answer · <b>{view.changes.filter((c) => c.state === "waiting").length}</b></Label>
                {view.changes.length === 0 && <span className="small muted">Nothing to answer.</span>}
                <div>
                  {view.changes.map((c) => (
                    <div key={c.id} className="change">
                      <div><b>{c.summary}</b> <span className="muted">· {c.asked_by}, {day(c.asked_at)}, in the customiser</span></div>
                      <span className={`small ${c.check.passes ? "tone-ok" : "tone-bad"}`}>{c.check.words}</span>
                      {c.state === "waiting" ? (
                        <form action={actions.answer} className="stack is-tight">
                          <Ref /><input type="hidden" name="amendment" value={c.id} />
                          <input className="field" name="words" placeholder="For a suggestion or a decline: what we can make, or why not" aria-label="Suggestion or reason" />
                          <div className="actions">
                            <button className="btn is-next" name="intent" value="accept">Accept</button>
                            <button className="btn" name="intent" value="suggest">Suggest another size</button>
                            <button className="btn" name="intent" value="decline">Decline</button>
                            <span className="btn is-off" title="Opens with the customiser">Open in customiser</span>
                          </div>
                        </form>
                      ) : <span className="small">Suggested {c.suggestion}, sent {day(c.answered_at)} · <Chip tone="warn">Waiting on client</Chip></span>}
                    </div>
                  ))}
                </div>
              </div>
            </section>
            <section className="panel">
              <div className="panel-body">
                <Label>Freight · <b>to {view.ship_to}</b></Label>
                {view.freight ? view.freight.freight_options.map((o) => (
                  <div key={o.service} className={`pick${o.service === view.freight_chosen ? " is-on" : ""}`}>
                    <span><b style={{ textTransform: "capitalize" }}>{o.service}</b> · {plural(o.transit_days, "day")} · {plural(view.freight!.carton_count, "carton")} · by {day(o.target_date)}</span>
                    <span className="mono">{rand(o.price_cents)}</span>
                  </div>
                )) : <span className="small muted">Nelson has no freight answer for this quote yet.</span>}
                <span className="small muted">Nelson re-prices the options when the address or the date changes. Carton count comes from the product data.</span>
              </div>
            </section>
          </>
        </div>

        <aside className="side">
          <div className="panel is-lead">
            <div className="panel-body">
              <Label>Thread · <b>{view.client.contact}</b> · ··· {view.client.phone_tail}</Label>
              {view.messages.length === 0 && <span className="small muted">No messages on this quote yet.</span>}
              <div className="thread">
                {view.messages.map((m) => (
                  <div key={m.at.toISOString()} className={`bubble${m.author === "nelson" ? " is-ours" : ""}`}>{m.text}<small>{m.name} · {dayTime(m.at)} · {m.channel}</small></div>
                ))}
              </div>
            </div>
            <div className="panel-body">
              <form action={actions.reply} className="reply">
                <Ref /><input className="field" name="message" placeholder="Reply…" aria-label="Reply to the client" /><button className="btn">Send</button>
              </form>
            </div>
          </div>
          <div className="panel">
            <div className="panel-body">
              <Label>Versions and files</Label>
              <span className="small">{view.versions.length ? view.versions.map((v, i) => <span key={v.version} className={i === view.versions.length - 1 ? "strong" : ""}>{i > 0 && " · "}<a href={`/quotes/${view.ref}/pdf?v=${v.version}`}>v{v.version}</a> {v.sent}</span>) : "Not sent yet."}</span>
              <span className="small muted">Mockups zip and artwork join here when the customiser publishes designs.</span>
              <span className="small muted">Sends by email and to the portal, always. WhatsApp once the client has opted in.{view.valid_until ? ` Valid to ${day(view.valid_until)}.` : ""}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function DeskDocumentScreen({ doc, printButton }: { doc: QuoteDocument; printButton: ReactNode }) {
  return (
    <div className="page">
      <header className="head">
        <a className="crumb" href={`/quotes/${doc.ref}`}>← {doc.ref}</a>
        <h1>Official quote <span>· {doc.ref} v{doc.version} · what the client gets</span></h1>
        <div className="head-end">
          {doc.versions.length > 1 && <nav className="tabs" aria-label="Version">{doc.versions.map((v) => <a key={v} href={`/quotes/${doc.ref}/pdf?v=${v}`} aria-current={v === doc.version ? "page" : undefined}><Chip>v{v}</Chip></a>)}</nav>}
          {printButton}
        </div>
      </header>
      <div className="cols">
        <QuoteSheet doc={doc} />
        <aside className="side">
          <div className="panel is-lead">
            <div className="panel-body"><Label>About this document</Label><span className="small">Made from the quote version, never typed. Fixed quantities, terms and one total, so a client can put it in for budget approval.</span></div>
            <div className="panel-body"><Label>Goes with it</Label><span className="small muted">Mockup sheet, mockups zip and change log join here when the customiser publishes designs.</span></div>
            <div className="panel-body small muted">Never on it: supplier names, costs or margin. This page is built from the client’s view of the quote and checked before it draws.</div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// Today, quotes only for now: what needs an answer and what needs a chase, oldest trouble first.
export function TodayScreen({ view, said, actions }: { view: Pipeline; said: Said; actions: PipelineActions }) {
  const rows = view.groups.flatMap((g) => g.rows);
  const needsYou = rows.filter((r) => r.group === "working" && r.tone === "warn");
  const chase = rows.filter((r) => r.group === "overdue" || r.group === "due");
  const waitingValue = rows.filter((r) => r.group !== "decided").reduce((sum, r) => sum + (r.total_cents ?? 0), 0);
  return (
    <div className="page">
      <header className="head"><h1>Today <span>· {plural(needsYou.length + chase.length, "thing")} need you</span></h1></header>
      <Notice notice={said} />
      <div className="cols">
        <div className="stack">
          {[{ title: "Needs you", hint: "A client is waiting on your answer", list: needsYou }, { title: "Chase", hint: "Each one waits for your send", list: chase }].map((g) => (
            <section key={g.title} className="group">
              <div className="group-head"><span className="label"><b>{g.title}</b></span><span className="label">{g.hint}</span></div>
              {g.list.length === 0 && <p className="empty">Clear.</p>}
              {g.list.map((row) => <Row key={row.ref} row={row} actions={actions} />)}
            </section>
          ))}
        </div>
        <aside className="side">
          <div className="panel is-lead">
            <div className="panel-body">
              <Label>Quotes</Label>
              <div className="stats">
                <div className="stat"><b>{view.counts.open}</b><span>open</span></div>
                <div className="stat"><b>{rand(waitingValue, { decimals: false })}</b><span>out with clients</span></div>
                <div className="stat"><b>{view.month.win_pct === null ? "—" : `${view.month.win_pct}%`}</b><span>won</span></div>
              </div>
            </div>
            <div className="panel-body small muted">Today shows quotes only for now. Orders, proofs and the inbox join as each is built.</div>
          </div>
        </aside>
      </div>
    </div>
  );
}
