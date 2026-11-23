import Link from "next/link";

export default function Footer() {
  const phone = process.env.NEXT_PUBLIC_PHONE || "1800 000 0000";
  const email = process.env.NEXT_PUBLIC_EMAIL || "hello@ribriz.example";
  return (
    <footer className="site">
      <div className="wrap"><div className="big" aria-hidden="true">ribriz travel</div></div>
      <div className="wrap cols">
        <div>
          <Link className="logo" href="/" style={{ marginBottom: 14 }}>
            <img src="/img/logo.png" alt="Ribriz" width={118} height={48} />
            <span className="word">TRAVEL</span>
          </Link>
          <p>Holiday packages, escorted group tours and beach hotels from India and Europe. One honest price, taxes shown before you book.</p>
          <p>Photos from Unsplash.</p>
        </div>
        <div>
          <h4>Holidays</h4>
          <Link href="/trips?region=India">India packages</Link>
          <Link href="/trips">International</Link>
          <Link href="/trips?kind=escorted">Group tours</Link>
          <Link href="/trips?deal=lm">Last minute</Link>
          <Link href="/trips?kind=cruise">Cruises</Link>
        </div>
        <div>
          <h4>Help</h4>
          <Link href="/plan">Plan a custom trip</Link>
          <Link href="/saved">Saved trips</Link>
          <Link href="/compare">Compare trips</Link>
          <Link href="/#services">Visa &amp; forex</Link>
        </div>
        <div>
          <h4>Talk to us</h4>
          <p className="mono" style={{ opacity: 1, fontSize: 16 }}>{phone}</p>
          <p style={{ userSelect: "all" }}>{email}</p>
          <p>Daily, 8 am – 11 pm IST</p>
          <p style={{ marginTop: 14 }}>© {new Date().getFullYear()} Ribriz Travel</p>
        </div>
      </div>
    </footer>
  );
}
