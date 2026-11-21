// The Portal's Settings screen: three short groups, one Save.
import { Chip, Notice } from "../ui/bits.tsx";
import type { PortalSettings } from "./settings.ts";

type Action = (form: FormData) => Promise<void>;
type Said = { ok: boolean; text: string } | null;

export function SettingsScreen({ view, said, save }: { view: PortalSettings; said: Said; save: Action }) {
  return (
    <div className="page is-calm">
      <header className="head"><h1>Settings</h1></header>
      <Notice notice={said} />
      <section className="group">
        <h2 className="group-title">Company and delivery</h2>
        <div className="list">
          {view.company.map((row) => (
            <article key={row.label} className="item"><div className="item-main"><span className="item-sub">{row.label}</span><span className="item-title">{row.words}</span></div></article>
          ))}
        </div>
      </section>
      <section className="group">
        <h2 className="group-title">Updates</h2>
        <form action={save}>
          <div className="list">
            {view.updates.map((u) => (
              <article key={u.kind} className="item">
                <div className="item-main"><span className="item-title">{u.title}</span><span className="item-sub">{u.sub}</span></div>
                <span className="picks">
                  <label><input type="checkbox" name={`${u.kind}_email`} defaultChecked={u.email} disabled={u.locked || !view.may_change} /> Email</label>
                  <label><input type="checkbox" name={`${u.kind}_whatsapp`} defaultChecked={u.whatsapp} disabled={u.locked || !view.may_change} /> WhatsApp</label>
                </span>
              </article>
            ))}
          </div>
          {view.may_change && <p className="save-row"><button className="btn is-next" type="submit">Save</button></p>}
        </form>
      </section>
      <section className="group">
        <h2 className="group-title">Team</h2>
        <div className="list">
          {view.team.map((p) => (
            <article key={p.name} className="item">
              <div className="item-main"><span className="item-title">{p.name}{p.you ? " · you" : ""}</span><span className="item-sub">{p.sub}</span></div>
              <Chip tone={p.role === "Owner" ? "ink" : "plain"}>{p.role}</Chip>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
