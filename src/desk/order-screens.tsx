// The Desk's order screens, drawn from their views. Desk only: the order page names the supplier and their order
// number. Rendered on the server, never shipped as code.
import { Chip, Notice, Steps, Tabs, Tile } from "../ui/bits.tsx";
import { dayTime, rand } from "../ui/format.ts";
import type { Board, BoardRow, BoardTab, DeskOrder } from "./orders.ts";

type Action = (form: FormData) => Promise<void>;
type Said = { ok: boolean; text: string } | null;
export type OrderActions = { approve: Action; sendBack: Action; place: Action; waybill: Action; delivered: Action; hold: Action; release: Action };

const TAB_WORDS: Record<BoardTab, string> = { open: "Open", done: "Done" };

// One order, one row: who, what, what it waits on, when it is due, the one thing to do.
export const OrderRow = ({ row, place }: { row: BoardRow; place: Action }) => (
  <article className="item">
    <a className="item-main" href={`/orders/${row.ref}`}>
      <span className="item-title">{row.client}</span>
      <span className="item-sub">{row.what ? `${row.ref} · ${row.what}` : row.ref}</span>
    </a>
    <Chip tone={row.chip.tone}>{row.chip.words}</Chip>
    <span className={`item-total${row.late ? " tone-bad" : ""}`}>{row.target}</span>
    {row.action.place ? (
      <form action={place}><input type="hidden" name="ref" value={row.ref} /><input type="hidden" name="from" value="board" /><button className="btn is-next">{row.action.label}</button></form>
    ) : <a className={`btn${row.action.next ? " is-next" : ""}`} href={`/orders/${row.ref}`}>{row.action.label}</a>}
  </article>
);

export const OrderGroup = ({ title, rows, place }: { title: string; rows: BoardRow[]; place: Action }) => (
  <section className="group">
    <h2 className="group-title">{title}</h2>
    {rows.length === 0 ? <p className="empty">Clear.</p> : <div className="list">{rows.map((row) => <OrderRow key={row.ref} row={row} place={place} />)}</div>}
  </section>
);

export function BoardScreen({ view, said, place }: { view: Board; said: Said; place: Action }) {
  return (
    <div className="page is-calm is-wide">
      <header className="head">
        <h1>Orders</h1>
        <Tabs tabs={(Object.keys(TAB_WORDS) as BoardTab[]).map((t) => ({ label: TAB_WORDS[t], count: view.counts[t], href: t === "open" ? "/orders" : `/orders?tab=${t}`, current: t === view.tab }))} />
      </header>
      <Notice notice={said} />
      {view.tab === "open"
        ? view.groups.map((g) => <OrderGroup key={g.key} title={g.title} rows={g.rows} place={place} />)
        : <OrderGroup title="Done" rows={view.flat} place={place} />}
    </div>
  );
}

// The one move this order is waiting on, as the only thing in the lead panel.
function NextMove({ view, actions }: { view: DeskOrder; actions: OrderActions }) {
  const Ref = () => <input type="hidden" name="ref" value={view.ref} />;
  switch (view.move) {
    case "check_proof":
      return (
        <div className="hero-do">
          <form action={actions.approve}><Ref /><button className="btn is-big is-next">Approve and send to client</button></form>
          <details className="inline-more">
            <summary>Send it back</summary>
            <form action={actions.sendBack} className="reply"><Ref /><input className="field" name="note" placeholder="What must be fixed" aria-label="What must be fixed" /><button className="btn">Send back</button></form>
          </details>
        </div>
      );
    case "place_order":
      return <form action={actions.place} className="hero-do"><Ref /><button className="btn is-big is-next">Place the supplier order</button><span className="small muted">Tells the client it is in production.</span></form>;
    case "waybill":
    case "wait_production":
      return <form action={actions.waybill} className="hero-do"><Ref /><input className="field" name="waybill" placeholder="Waybill number" aria-label="Waybill number" /><button className={`btn is-big${view.move === "waybill" ? " is-next" : ""}`}>Save waybill</button></form>;
    case "on_road":
      return <form action={actions.delivered} className="hero-do"><Ref /><span className="small">Waybill <b className="mono">{view.shipment?.waybill}</b></span><button className="btn">Mark delivered</button></form>;
    case "held":
      return <form action={actions.release} className="hero-do"><Ref /><button className="btn is-big is-next">Release the hold</button></form>;
    case "wait_client":
      return <div className="hero-do"><span className="small muted">With {view.client.contact} to sign.</span></div>;
    case "wait_sheet":
      return <div className="hero-do"><span className="small muted">The print house sends the sheet.</span></div>;
    case "done":
      return null;
  }
}

export function DeskOrderScreen({ view, said, actions }: { view: DeskOrder; said: Said; actions: OrderActions }) {
  return (
    <div className="page is-calm is-wide">
      <header className="head">
        <a className="crumb" href="/orders">← Orders</a>
        <h1><a href={`/clients/${view.client.id}`}>{view.client.name}</a> <span>· {view.title}</span></h1>
        <Chip tone={view.chip.tone}>{view.chip.words}</Chip>
      </header>
      <Notice notice={said} />

      <section className="panel is-lead hero">
        <div>
          <span className="hero-label">{view.ref} · {view.state_word}</span>
          <b className={`hero-total${view.late ? " tone-bad" : ""}`}>{view.target || view.chip.words}</b>
          {view.hold && <span className="small tone-bad">On hold since {view.hold.since}. {view.hold.reason}</span>}
        </div>
        <NextMove view={view} actions={actions} />
      </section>
      <Steps steps={view.steps} />

      <section className="list">
        {view.lines.map((l) => (
          <article key={l.id} className="item is-line">
            <Tile picture={l.picture} colours={[l.colour_hex]} label={l.name} />
            <div className="item-main">
              <span className="item-title">{l.name}</span>
              <span className="item-sub">{l.quantity} · {l.colour}</span>
              <span className="item-sub">{l.decoration_words}</span>
            </div>
            <span className="item-total">{rand(view.total_cents, { decimals: false })}</span>
          </article>
        ))}
      </section>

      <details className="more" open={view.move === "check_proof"}>
        <summary>Proof · {view.proof.ref}</summary>
        {view.proof.sheet_picture ? <div className="proof-sheet"><img src={view.proof.sheet_picture} alt={`Proof sheet for ${view.title}`} /></div> : null}
        <p className="small muted">
          {view.proof.arrived ? `Sheet in ${view.proof.arrived} · round ${view.proof.round}` : "No sheet yet."}
          {view.proof.sent ? ` · sent ${view.proof.sent}` : ""}{view.proof.signed ? ` · signed by ${view.proof.signed}` : ""}
        </p>
      </details>
      <details className="more">
        <summary>Supplier</summary>
        <div className="sums">
          <div><span>{view.supply?.supplier ?? "Not set"}</span><span className="mono">{view.supply?.supplier_order_ref ?? "Not placed"}</span></div>
          {view.shipment && <div><span>{view.shipment.service} · sent {view.shipment.sent}</span><span className="mono">{view.shipment.waybill}</span></div>}
        </div>
      </details>
      <details className="more">
        <summary>Timeline</summary>
        <div className="sums">
          {view.log.map((e) => <div key={e.at.toISOString() + e.words}><span>{e.words}</span><span className="small muted">{dayTime(e.at)}</span></div>)}
        </div>
        <p className="small muted">Paid {view.paid} · {rand(view.total_cents)}{view.quote_ref ? <> · <a href={`/quotes/${view.quote_ref}`}>{view.quote_ref}</a></> : " · shop order"}</p>
      </details>
      {view.move !== "done" && view.move !== "held" && (
        <details className="more">
          <summary>Put on hold</summary>
          <form action={actions.hold} className="reply"><input type="hidden" name="ref" value={view.ref} /><input className="field" name="reason" placeholder="Why. The client reads this" aria-label="Reason for the hold" /><button className="btn">Hold</button></form>
        </details>
      )}
    </div>
  );
}
