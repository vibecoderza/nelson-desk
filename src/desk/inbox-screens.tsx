// The Inbox, drawn from its view. Who, what they said, what was read from it, one thing to do.
import { Chip, Notice } from "../ui/bits.tsx";
import { dayTime } from "../ui/format.ts";
import type { Inbox, InboxRow } from "./inbox.ts";

type Action = (form: FormData) => Promise<void>;
type Said = { ok: boolean; text: string } | null;

const Row = ({ row, start }: { row: InboxRow; start: Action }) => (
  <article className="item is-message">
    <div className="item-main">
      <span className="item-title">{row.client_id ? <a href={`/clients/${row.client_id}`}>{row.who}</a> : row.who}</span>
      <span className="item-sub">{row.channel} · {dayTime(row.at)}</span>
      <span className="message">{row.text}</span>
      {(row.read || row.artwork) && <span className="chips is-start">{row.read && <Chip>{row.read}</Chip>}{row.artwork && <Chip tone="ok">Artwork</Chip>}</span>}
    </div>
    {row.can_start
      ? <form action={start}><input type="hidden" name="id" value={row.id} /><button className="btn is-next">Start a quote</button></form>
      : row.open && <a className={`btn${row.waiting ? " is-next" : ""}`} href={row.open.href}>{row.open.label}</a>}
  </article>
);

const Group = ({ title, rows, start }: { title: string; rows: InboxRow[]; start: Action }) => (
  <section className="group">
    <h2 className="group-title">{title}</h2>
    {rows.length === 0 ? <p className="empty">Clear.</p> : <div className="list">{rows.map((row) => <Row key={row.id} row={row} start={start} />)}</div>}
  </section>
);

export function InboxScreen({ view, said, start }: { view: Inbox; said: Said; start: Action }) {
  return (
    <div className="page is-calm is-wide">
      <header className="head"><h1>Inbox</h1></header>
      <Notice notice={said} />
      <Group title="Waiting on you" rows={view.waiting} start={start} />
      <Group title="Answered" rows={view.answered} start={start} />
    </div>
  );
}
