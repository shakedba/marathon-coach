export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <div className="card" style={{ maxWidth: 360, margin: "60px auto" }}>
      <h1>Marathon Coach · מאמן מרתון</h1>
      <form action="/api/login" method="post">
        <label>Password · סיסמה</label>
        <input name="password" type="password" autoComplete="current-password" required dir="ltr" />
        <div style={{ marginTop: 12 }}><button className="primary">Log in · כניסה</button></div>
        {e === "1" && <p style={{ color: "var(--bad)" }}>Wrong password · סיסמה שגויה</p>}
        {e === "locked" && <p style={{ color: "var(--bad)" }}>Too many attempts, try again in 15 minutes · יותר מדי ניסיונות, נסה שוב בעוד 15 דקות</p>}
      </form>
    </div>
  );
}
