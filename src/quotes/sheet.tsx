// The official quote as a sheet of paper. One drawing for the Desk's preview, the client's copy and the print.
import type { QuoteDocument } from "./document.ts";
import { dayYear, rand } from "../ui/format.ts";

export function QuoteSheet({ doc }: { doc: QuoteDocument }) {
  return (
    <article className="sheet">
      <header className="sheet-head">
        <span className="wordmark">nelson</span>
        <div className="sheet-meta">
          <b>QUOTATION</b>
          <span>{doc.ref} · version {doc.version}</span>
          <span className="muted">{dayYear(doc.dated)}{doc.valid_until ? ` · valid to ${dayYear(doc.valid_until)}` : ""}</span>
        </div>
      </header>
      <section className="sheet-two">
        <div><span className="label">For</span><b>{doc.for.company}</b><span>{doc.for.person}</span><span>{doc.for.address}</span></div>
        <div><span className="label">From</span><b>{doc.from.company}</b><span>{doc.from.email}</span></div>
      </section>
      <table className="items">
        <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Each</th><th className="num">Amount</th></tr></thead>
        <tbody>
          {doc.items.map((item) => (
            <tr key={item.name}>
              <td><b>{item.name}</b><small>{item.detail}</small></td>
              <td className="num">{item.quantity}</td>
              <td className="num">{rand(item.each_cents)}</td>
              <td className="num">{rand(item.amount_cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="sheet-total">
        <div><span>Total</span><b>{rand(doc.total_cents)}</b></div>
        <span className="small muted">No VAT charged.</span>
      </div>
      <footer className="sheet-foot sheet-two">
        <div><span className="label">Terms</span><span>{doc.terms}</span></div>
        <div><span className="label">Accept and pay</span>{doc.accept.map((line) => <span key={line}>{line}</span>)}</div>
      </footer>
    </article>
  );
}
