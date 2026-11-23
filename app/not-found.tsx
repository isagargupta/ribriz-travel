import Link from "next/link";

export default function NotFound() {
  return (
    <div className="login-card" style={{ textAlign: "center" }}>
      <img src="/img/logo.png" alt="Ribriz Travel" style={{ height: 48, margin: "0 auto" }} />
      <h1 style={{ fontSize: 26 }}>Page not found</h1>
      <p className="muted" style={{ margin: 0 }}>This page or trip may have moved or is no longer on sale.</p>
      <Link className="btn hot" href="/trips">Browse all trips</Link>
      <Link className="btn" href="/">Go to home page</Link>
    </div>
  );
}
