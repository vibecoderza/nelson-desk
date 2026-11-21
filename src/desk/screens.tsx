// The Desk's three quote screens, drawn from their views. Desk only: the builder shows supplier, cost, mark-up
// and margin. Rendered on the server, never shipped as code.
import type { ReactNode } from "react";
import { Chip, Label, Notice, Tabs, Tile } from "../ui/bits.tsx";
import { count, day, dayTime, rand } from "../ui/format.ts";
import type { QuoteDocument } from "../quotes/document.ts";
import { QuoteSheet } from "../quotes/sheet.tsx";
import type { Builder, Pipeline, PipelineRow, PipelineTab } from "./quotes.ts";
import { OrderGroup } from "./order-screens.tsx";
import type { Board } from "./orders.ts";

type Action = (form: FormData) => Promise<void>;
type Said = { ok: boolean; text: string } | null;
export type PipelineActions = { followUp: Action; rework: Action };
export type BuilderActions = { answer: Action; send: Action; reply: Action };

const TAB_WORDS: Record<PipelineTab, string> = { open: "Open", accepted: "Accepted", declined: "Declined", expired: "Expired" };
const decimal = (n: number) => String(n).replace(".", ",");

function RowAction({ row, actions }: { row: PipelineRow; actions: PipelineActions }) {
  const { kind, label, next } = row.action;
  if (kind === "open") return <a className="btn" href={`/quotes/${row.ref}`}>{label}</a>;
  if (kind === "order") return <a className="btn" href={row.order_ref ? `/orders/${row.order_ref}` : `/quotes/${row.ref}`}>Order</a>;
  const follow = kind === "send_check_in" ? "check_in" : kind === "send_video_ask" ? "video_ask" : kind === "last_ask" ? "last_ask" : null;
  return (
    <form action={follow ? actions.followUp : actions.rework}>
      <input type="hidden" name="ref" value={row.ref} /><input type="hidden" name="from" value="pipeline" />
      {follow && <input type="hidden" name="kind" value={follow} />}
      <button className={`btn${next ? " is-next" : ""}`}>{label}</button>
    </form>
  );
}

// One quote, one row: who, what, where it stands, what it is worth, the one thing to do.
const Row = ({ row, actions }: { row: PipelineRow; actions: PipelineActions }) => (
  <article className="item">
    <a className="item-main" href={`/quotes/${row.ref}`}>
      <span className="item-title">{row.client}</span>
      <span className="item-sub">{row.ref} · {row.what}</span>
    </a>
    <Chip tone={row.chip.tone}>{row.chip.words}</Chip>
    <span className="item-total">{rand(row.total_cents, { decimals: false })}</span>
    <RowAction row={row} actions={actions} />
  </article>
);

const Group = ({ title, rows, actions }: { title: string; rows: PipelineRow[]; actions: PipelineActions }) => (
  <section className="group">
    <h2 className="group-title">{title}</h2>
    {rows.length === 0 ? <p className="empty">Clear.</p> : <div className="list">{rows.map((row) => <Row key={row.ref} row={row} actions={actions} />)}</div>}
  </section>
);

export function PipelineScreen({ view, said, actions }: { view: Pipeline; said: Said; actions: PipelineActions }) {
  const most = Math.max(1, ...view.lost.map((l) => l.count));
  return (
    <div className="page is-calm is-wide">
      <header className="head">
        <h1>Quotes</h1>
        <Tabs tabs={(Object.keys(TAB_WORDS) as PipelineTab[]).map((t) => ({ label: TAB_WORDS[t], count: view.counts[t], href: t === "open" ? "/quotes" : `/quotes?tab=${t}`, current: t === view.tab }))} />
      </header>
      <Notice notice={said} />
      {view.tab === "open"
        ? view.groups.map((g) => <Group key={g.key} title={g.title} rows={g.rows} actions={actions} />)
        : <Group title={TAB_WORDS[view.tab]} rows={view.flat} actions={actions} />}
      <details className="more">
        <summary>Numbers</summary>
        <div className="stats">
          <div className="stat"><b>{view.month.win_pct === null ? "—" : `${view.month.win_pct}%`}</b><span>won · {view.month.won} of {view.month.decided}</span></div>
          <div className="stat"><b>{view.month.hours_to_first_quote === null ? "—" : `${decimal(view.month.hours_to_first_quote)} h`}</b><span>to first quote</span></div>
          <div className="stat"><b>{view.month.days_to_decision === null ? "—" : `${decimal(view.month.days_to_decision)} d`}</b><span>to a decision</span></div>
        </div>
        <div className="bars">
          {view.lost.map((l) => <div key={l.words} className="bar"><span>{l.words}</span><i style={{ width: `${(l.count / most) * 100}%` }} /><span className="mono">{l.count}</span></div>)}
        </div>
      </details>
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
        <h1>{view.client.name} <span>· {view.title}</span></h1>
        <Chip tone={stateTone} caps>{view.version ? `v${view.version} · ` : ""}{view.state_word}</Chip>
        <div className="head-end">
          {view.version > 0 && <a className="btn" href={`/quotes/${view.ref}/pdf`}>PDF</a>}
          {view.can_send && <form action={actions.send}><Ref /><button className="btn is-next">Send v{view.next_version}</button></form>}
        </div>
      </header>
      <Notice notice={said} />
      {!view.nelson.ok && <p className="mockbar"><span className="label" style={{ color: "inherit" }}>Nelson</span>{view.nelson.words}</p>}
      <section className="list">
        {view.lines.map((l) => (
          <article key={l.id} className="item is-line">
            <Tile picture={l.picture} colours={[l.colour_hex]} label={l.name} />
            <div className="item-main">
              <span className="item-title">{l.name}</span>
              <span className="item-sub">{count(l.quantity)} · {l.colour} · {rand(l.unit_cents)} each{l.price === "frozen" ? " · as sent" : ""}</span>
            </div>
            <span className="item-total">{rand(l.line_total_cents)}</span>
            {l.tone !== "ok" && <div className="item-note"><Chip tone={l.tone}>{l.state_word}</Chip></div>}
          </article>
        ))}
      </section>

      <section className="totalbar">
        <div><Label>Sell</Label><b>{rand(view.totals?.total_cents, { decimals: false })}</b></div>
        <div><Label>Margin</Label><b className="tone-ok">{view.staff_totals ? `${rand(view.staff_totals.margin_cents, { decimals: false })} · ${decimal(view.staff_totals.margin_pct)}%` : "—"}</b></div>
        <div><Label>Waiting on</Label><b className={view.waiting.tone === "plain" ? "" : `tone-${view.waiting.tone}`} style={{ fontFamily: "inherit", fontSize: 15 }}>{view.waiting.words}</b></div>
      </section>

      <details className="more">
        <summary>Cost, supplier and stock</summary>
        <div className="table-wrap">
          <table className="lines">
            <thead>
              <tr><th>Line</th><th>Supplier</th><th className="num">Stock</th><th className="num">Cost</th><th className="num">Branding</th><th className="num">Mark-up</th><th className="num">Margin</th></tr>
            </thead>
            <tbody>
              {view.lines.map((l) => (
                <tr key={l.id}>
                  <td><b>{l.name}</b><small className="mono">{l.product_code}</small><small>{l.decoration_words}</small></td>
                  <td>{l.staff ? <>{l.staff.supplier}<small className="mono">{l.staff.supplier_code}</small></> : <span className="muted">—</span>}</td>
                  <td className="num">{l.staff ? <><span className={stockTone(l.staff.stock, l.quantity)}>{count(l.staff.stock)}</span>{l.staff.incoming_stock[0] && <small>+{count(l.staff.incoming_stock[0].quantity)} · {day(l.staff.incoming_stock[0].due)}</small>}</> : "—"}</td>
                  <td className="num">{rand(l.staff?.unit_cost_cents)}</td>
                  <td className="num">{rand(l.staff?.branding_cost_cents)}</td>
                  <td className="num" title="Nelson’s rule. Read-only on the Desk.">{l.staff ? `${decimal(l.staff.markup_applied_pct)}%` : "—"}</td>
                  <td className="num">{l.staff ? <><span className="tone-ok">{rand(l.staff.margin_cents, { decimals: false })}</span><small>{decimal(l.staff.margin_pct)}%</small></> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">Cost {rand(view.staff_totals?.cost_cents, { decimals: false })}{view.totals ? ` · setup ${rand(view.totals.setup_cents, { decimals: false })} · freight ${rand(view.totals.delivery_cents, { decimals: false })}` : ""}</p>
      </details>
      <div className="cols">
        <div className="stack">
          <>
            <section className="panel">
              <div className="panel-body">
                <Label>Changes to answer</Label>
                {view.changes.length === 0 && <span className="small muted">Nothing to answer.</span>}
                <div>
                  {view.changes.map((c) => (
                    <div key={c.id} className="change">
                      <div><b>{c.summary}</b> <span className="muted">· {c.asked_by}, {day(c.asked_at)}</span></div>
                      <span className={`small ${c.check.passes ? "tone-ok" : "tone-bad"}`}>{c.check.words}</span>
                      {c.state === "waiting" ? (
                        <form action={actions.answer} className="stack is-tight">
                          <Ref /><input type="hidden" name="amendment" value={c.id} />
                          <input className="field" name="words" placeholder="What we can make, or why not" aria-label="Suggestion or reason" />
                          <div className="actions">
                            <button className="btn is-next" name="intent" value="accept">Accept</button>
                            <button className="btn" name="intent" value="suggest">Suggest another size</button>
                            <button className="btn" name="intent" value="decline">Decline</button>
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
                <Label>Delivery · {view.ship_to}</Label>
                {view.freight ? view.freight.freight_options.map((o) => (
                  <div key={o.service} className={`pick${o.service === view.freight_chosen ? " is-on" : ""}`}>
                    <span><b style={{ textTransform: "capitalize" }}>{o.service}</b> · by {day(o.target_date)}</span>
                    <span className="mono">{rand(o.price_cents)}</span>
                  </div>
                )) : <span className="small muted">Nelson has no freight answer for this quote yet.</span>}
              </div>
            </section>
          </>
        </div>

        <aside className="side">
          <div className="panel is-lead">
            <div className="panel-body">
              <Label>{view.client.contact}</Label>
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
              <Label>Versions</Label>
              <span className="small">{view.versions.length ? view.versions.map((v, i) => <span key={v.version} className={i === view.versions.length - 1 ? "strong" : ""}>{i > 0 && " · "}<a href={`/quotes/${view.ref}/pdf?v=${v.version}`}>v{v.version}</a> {v.sent}</span>) : "Not sent yet."}</span>
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
        <h1>Official quote <span>· {doc.ref} v{doc.version}</span></h1>
        <div className="head-end">
          {doc.versions.length > 1 && <nav className="tabs" aria-label="Version">{doc.versions.map((v) => <a key={v} href={`/quotes/${doc.ref}/pdf?v=${v}`} aria-current={v === doc.version ? "page" : undefined}><Chip>v{v}</Chip></a>)}</nav>}
          {printButton}
        </div>
      </header>
      <QuoteSheet doc={doc} />
    </div>
  );
}

// Today: what needs Alan, orders first because they are paid for, then quotes, then who to chase. Headers and rows.
export function TodayScreen({ view, orders, said, actions }: { view: Pipeline; orders: Board; said: Said; actions: PipelineActions & { place: Action } }) {
  const rows = view.groups.flatMap((g) => g.rows);
  const needsYou = rows.filter((r) => r.group === "working" && r.tone === "warn");
  const chase = rows.filter((r) => r.group === "overdue" || r.group === "due");
  return (
    <div className="page is-calm is-wide">
      <header className="head"><h1>Today</h1></header>
      <Notice notice={said} />
      <OrderGroup title="Orders to move" rows={orders.groups.find((g) => g.key === "needs_you")?.rows ?? []} place={actions.place} />
      <Group title="Quotes to answer" rows={needsYou} actions={actions} />
      <Group title="Chase" rows={chase} actions={actions} />
    </div>
  );
}
