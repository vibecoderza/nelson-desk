// The Portal's Brand kit and Artwork screens. Rows, one chip, one button where something needs the client.
import { Chip, Notice, Tile } from "../ui/bits.tsx";
import type { ArtworkRow, PortalArtwork, PortalBrandKit } from "./brand.ts";

type Action = (form: FormData) => Promise<void>;
type Said = { ok: boolean; text: string } | null;
type KitRow = PortalBrandKit["colours"][number];

const KitGroup = ({ title, rows, swatch, mayConfirm, confirm }: { title: string; rows: KitRow[]; swatch: boolean; mayConfirm: boolean; confirm: Action }) => rows.length === 0 ? null : (
  <section className="group">
    <h2 className="group-title">{title}</h2>
    <div className="list">
      {rows.map((row) => (
        <article key={row.id} className={`item${swatch ? " has-tile" : ""}`}>
          {swatch && <Tile picture={null} colours={row.tiles} label={row.title} />}
          <div className="item-main">
            <span className="item-title">{row.title}</span>
            {row.sub && <span className="item-sub">{row.sub}</span>}
          </div>
          {!row.sure && <Chip tone="warn">Guess · confirm</Chip>}
          {!row.sure && mayConfirm && (
            <form action={confirm}><input type="hidden" name="id" value={row.id} /><button className="btn" type="submit">Confirm</button></form>
          )}
        </article>
      ))}
    </div>
  </section>
);

export function BrandKitScreen({ view, said, confirm }: { view: PortalBrandKit; said: Said; confirm: Action }) {
  return (
    <div className="page is-calm">
      <header className="head">
        <h1>Brand kit</h1>
        {view.guesses > 0 && <Chip tone="warn">{view.guesses} to confirm</Chip>}
      </header>
      <Notice notice={said} />
      {view.read === null ? <p className="empty">No brand kit yet. Send Nelson your brand guide and it appears here.</p> : (
        <>
          <p className="small muted">{view.read}. Your logos are in <a href="/artwork">Artwork</a>.</p>
          <KitGroup title="Colours" rows={view.colours} swatch mayConfirm={view.may_confirm} confirm={confirm} />
          <KitGroup title="Type" rows={view.fonts} swatch={false} mayConfirm={view.may_confirm} confirm={confirm} />
          <KitGroup title="Rules" rows={view.rules} swatch={false} mayConfirm={view.may_confirm} confirm={confirm} />
        </>
      )}
    </div>
  );
}

const ArtGroup = ({ title, rows, redraw }: { title: string; rows: ArtworkRow[]; redraw: Action }) => rows.length === 0 ? null : (
  <section className="group">
    <h2 className="group-title">{title}</h2>
    <div className="list">
      {rows.map((row) => (
        <article key={row.id} className="item has-tile">
          <Tile picture={null} colours={row.tiles} label={row.name} />
          <div className="item-main">
            <span className="item-title">{row.name}</span>
            <span className="item-sub">{row.sub}</span>
          </div>
          <Chip tone={row.chip.tone}>{row.chip.words}</Chip>
          {row.can_redraw && (
            <form action={redraw}><input type="hidden" name="id" value={row.id} /><button className="btn is-next" type="submit">Ask for a redraw</button></form>
          )}
        </article>
      ))}
    </div>
  </section>
);

export function ArtworkScreen({ view, said, redraw }: { view: PortalArtwork; said: Said; redraw: Action }) {
  const none = view.yours.length + view.from_nelson.length === 0;
  return (
    <div className="page is-calm">
      <header className="head"><h1>Artwork</h1></header>
      <Notice notice={said} />
      {none && <p className="empty">No artwork yet. Files you send Nelson appear here once they are checked.</p>}
      <ArtGroup title="Your files" rows={view.yours} redraw={redraw} />
      <ArtGroup title="From Nelson" rows={view.from_nelson} redraw={redraw} />
    </div>
  );
}
