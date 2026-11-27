import { TrxApp } from "@/components/trx/TrxApp";
import { todayLocal } from "@/lib/dates";
import { strengthFor } from "@/lib/extras";
import { pick } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import * as db from "@/lib/db";
import { adviceFor, sessionById, trxAlternative, type LoggedTrx } from "@/lib/trx";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** `?d=YYYY-MM-DD` opens the TRX alternative for that day's planned strength session. */
export default async function TrxPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const lang = await getLang();
  const q = await searchParams;
  const today = todayLocal();
  const d = typeof q.d === "string" && DATE.test(q.d) ? q.d : today;
  const planned = strengthFor(d);
  const alt = planned ? trxAlternative(planned) : null;
  const s = typeof q.s === "string" && sessionById(q.s) ? q.s : alt?.session;
  const r = Number(q.r);
  // Account data is a bonus: the timer works even if the database is unreachable.
  const [custom, logs] = await Promise.all([
    db.kvGet<string[]>("trx_custom").catch(() => null),
    db.recentTrxLogs(10).catch(() => [] as LoggedTrx[]),
  ]);
  return (
    <TrxApp
      lang={lang}
      advice={adviceFor(d)}
      initial={s ? { session: s as "full" | "light" | "upper", rounds: r >= 1 && r <= 3 ? r : alt?.rounds ?? 2 } : null}
      replaces={planned ? { date: d, title: pick(lang, planned.title), today: d === today } : null}
      today={today}
      account={{ custom, logs }}
    />
  );
}
