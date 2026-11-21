// The Portal's Brand kit and Artwork screens. Rows, one chip, one button where something needs the client.
import { Chip, Notice, Tabs, Tile } from "../ui/bits.tsx";
import type { ArtworkRow, PortalArtwork, PortalBrandKit } from "./brand.ts";

type Action = (form: FormData) => Promise<void>;
type Said = { ok: boolean; text: string } | null;
type KitRow = PortalBrandKit["colours"][number];

const Guess = ({ row, view, confirm }: { row: { id: string; sure: boolean }; view: PortalBrandKit; confirm: Action }) => row.sure ? null : (
  <>
    <Chip tone="warn">{view.draft ? "Guess" : "Guess · confirm"}</Chip>
    {view.may_confirm && <form action={confirm}><input type="hidden" name="id" value={row.id} /><button className="btn" type="submit">Confirm</button></form>}
  </>
);

const KitGroup = ({ title, rows, swatch, view, confirm }: { title: string; rows: KitRow[]; swatch: boolean; view: PortalBrandKit; confirm: Action }) => rows.length === 0 ? null : (
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
          <Guess row={row} view={view} confirm={confirm} />
        </article>
      ))}
    </div>
  </section>
);

export function BrandKitScreen({ view, said, confirm, readSite }: { view: PortalBrandKit; said: Said; confirm: Action; readSite: Action }) {
  const nothing = view.read === null;
  return (
    <div className="page is-calm">
      <header className="head">
        <h1>Brand kit</h1>
        {view.guesses > 0 && !view.draft && <Chip tone="warn">{view.guesses} to confirm</Chip>}
      </header>
      <Notice notice={said} />
      <form className="ask-site" action={readSite}>
        <input className="field" name="site" type="text" inputMode="url" autoComplete="url" placeholder="yourbrand.co.za" aria-label="Your website" required />
        <button className={`btn${nothing ? " is-next" : ""}`} type="submit">Read my website</button>
      </form>
      {nothing ? <p className="empty">Paste your website and your colours, fonts and logo are read from it.</p> : (
        <>
          <p className="small muted">{view.read}.{view.draft ? <> Nothing is saved yet. <a href="/brand">Back to your kit</a>.</> : <> Your logos are in <a href="/artwork">Artwork</a>.</>}</p>
          {view.summary && (
            <section className="group">
              <h2 className="group-title">The brand</h2>
              <div className="list"><article className="item"><div className="item-main"><span className="brand-words">{view.summary.words}</span></div><Guess row={view.summary} view={view} confirm={confirm} /></article></div>
            </section>
          )}
          {view.logos.length > 0 && (
            <section className="group">
              <h2 className="group-title">Logo</h2>
              <div className="logo-row">{view.logos.map((src, i) => <img key={i} src={src} alt="A logo found on your website" />)}</div>
            </section>
          )}
          <KitGroup title="Colours" rows={view.colours} swatch view={view} confirm={confirm} />
          <KitGroup title="Type" rows={view.fonts} swatch={false} view={view} confirm={confirm} />
          <KitGroup title="Rules" rows={view.rules} swatch={false} view={view} confirm={confirm} />
        </>
      )}
    </div>
  );
}

const ArtGroup = ({ title, rows, redraw, makeMain }: { title: string; rows: ArtworkRow[]; redraw: Action; makeMain: Action }) => rows.length === 0 ? null : (
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
          {row.main && <Chip tone="ink">Main logo</Chip>}
          <Chip tone={row.chip.tone}>{row.chip.words}</Chip>
          {row.can_redraw && <form action={redraw}><input type="hidden" name="id" value={row.id} /><button className="btn is-next" type="submit">Ask for a redraw</button></form>}
          {row.can_be_main && <form action={makeMain}><input type="hidden" name="id" value={row.id} /><button className="btn" type="submit">Make main</button></form>}
        </article>
      ))}
    </div>
  </section>
);

export function ArtworkScreen({ view, said, redraw, makeMain }: { view: PortalArtwork; said: Said; redraw: Action; makeMain: Action }) {
  return (
    <div className="page is-calm">
      <header className="head">
        <h1>Artwork</h1>
        {view.filters.length > 2 && <Tabs tabs={view.filters.map((f) => ({ label: f.label, count: f.count, href: f.value === "all" ? "/artwork" : `/artwork?tag=${f.value}`, current: f.value === view.filter }))} />}
      </header>
      <Notice notice={said} />
      {view.total === 0 && <p className="empty">No artwork yet. Files you send Nelson appear here once they are checked.</p>}
      <ArtGroup title="Your files" rows={view.yours} redraw={redraw} makeMain={makeMain} />
      <ArtGroup title="From Nelson" rows={view.from_nelson} redraw={redraw} makeMain={makeMain} />
    </div>
  );
}
