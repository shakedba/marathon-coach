import { TrxApp } from "@/components/trx/TrxApp";
import { todayLocal } from "@/lib/dates";
import { getLang } from "@/lib/lang";
import { adviceFor } from "@/lib/trx";

export default async function TrxPage() {
  const lang = await getLang();
  return <TrxApp lang={lang} advice={adviceFor(todayLocal())} />;
}
