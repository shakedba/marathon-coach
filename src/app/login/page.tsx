import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <div className="card" style={{ maxWidth: 360, margin: "60px auto" }}>
      <h1>Marathon Coach · מאמן מרתון</h1>
      <LoginForm />
      {e === "1" && <p style={{ color: "var(--bad)" }}>Wrong password · סיסמה שגויה</p>}
      {e === "nodb" && <p style={{ color: "var(--bad)" }}>This preview has no database (by design, previews never touch your real data). Check the change on the main app after merge · לגרסת התצוגה המקדימה אין מסד נתונים (בכוונה, כדי שלא תיגע בנתונים האמיתיים). בודקים באפליקציה הראשית אחרי מיזוג.</p>}
      {e === "locked" && <p style={{ color: "var(--bad)" }}>Too many attempts, try again in 15 minutes · יותר מדי ניסיונות, נסה שוב בעוד 15 דקות</p>}
    </div>
  );
}
