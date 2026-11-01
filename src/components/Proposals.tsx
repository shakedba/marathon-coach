import { decideProposal } from "@/app/actions";
import { pick, tr } from "@/lib/i18n";
import type { Lang, Proposal } from "@/lib/types";

export function Proposals({ items, lang }: { items: { id: number; proposal: Proposal }[]; lang: Lang }) {
  const t = tr(lang);
  if (!items.length) return null;
  return (
    <>
      {items.map(({ id, proposal }) => (
        <div className="card" key={id} style={{ borderColor: "var(--accent)" }}>
          <div className="tag">{t("pending")}</div>
          <p style={{ margin: "8px 0" }}><b>{pick(lang, proposal.summary)}</b></p>
          {proposal.changes.length > 0 && (
            <table>
              <tbody>
                {proposal.changes.map((c) => (
                  <tr key={c.date}>
                    <td className="ltr">{c.date.slice(5)}</td>
                    <td>{pick(lang, c.from.title)} → <b>{pick(lang, c.to.title)}</b><div className="muted">{pick(lang, c.why)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <form action={decideProposal} className="row" style={{ marginTop: 10 }}>
            <input type="hidden" name="id" value={id} />
            {proposal.changes.length > 0 ? (
              <>
                <button className="primary" name="decision" value="accept">{t("accept")}</button>
                <button name="decision" value="reject">{t("reject")}</button>
              </>
            ) : (
              <button name="decision" value="accept">OK</button>
            )}
          </form>
        </div>
      ))}
    </>
  );
}
