// The mockup shop. The picture is the page: a wall of the client's own pieces, each with one thing to do.
import { Chip, Notice, Tabs } from "../ui/bits.tsx";
import { rand } from "../ui/format.ts";
import type { PortalShop } from "./shop.ts";

type Action = (form: FormData) => Promise<void>;
type Said = { ok: boolean; text: string } | null;

export function ShopScreen({ view, said, again }: { view: PortalShop; said: Said; again: Action }) {
  return (
    <div className="page is-calm is-shop">
      <header className="head">
        <h1>Mockup shop</h1>
        {view.counts.ordered > 0 && view.counts.ordered < view.counts.all && (
          <Tabs tabs={[{ label: "All", count: view.counts.all, href: "/shop", current: view.filter === "all" }, { label: "Ordered before", count: view.counts.ordered, href: "/shop?show=ordered", current: view.filter === "ordered" }]} />
        )}
      </header>
      <Notice notice={said} />
      {view.items.length === 0 ? <p className="empty">Your pieces appear here once Nelson has quoted them.</p> : (
        <section className="shop">
          {view.items.map((item) => (
            <article key={item.id} className="piece">
              <a className={`piece-picture${item.picture ? "" : " is-swatch"}`} href={item.from_href} aria-label={`${item.name}, on ${item.from_ref}`}>
                {item.picture ? <img src={item.picture} alt={item.name} loading="lazy" /> : <i style={{ background: item.tiles[0] }} />}
              </a>
              <div className="piece-words">
                <span className="item-title">{item.name}</span>
                <span className="item-sub">{item.guide ? `About ${rand(item.guide.unit_cents)} each at ${item.guide.quantity}` : item.colour}</span>
                {item.ordered && <Chip tone="ok">Ordered before</Chip>}
              </div>
              <form className="piece-again" action={again}>
                <input type="hidden" name="id" value={item.id} />
                <input className="field" name="quantity" type="text" inputMode="numeric" pattern="[0-9]{1,6}" placeholder="Qty" aria-label={`How many of ${item.name}`} required />
                <button className="btn" type="submit">{item.ordered ? "Order again" : "Quote me"}</button>
              </form>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
