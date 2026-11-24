import Link from "next/link";
import { COMPANY } from "@/lib/company";
import AskButton from "./me/AskButton";

export default function Footer() {
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
          <Link href="/booking">Find my booking</Link>
          <Link href="/plan">Plan a custom trip</Link>
          <Link href="/saved">Saved trips</Link>
          <Link href="/compare">Compare trips</Link>
          <Link href="/visa">Visa checker</Link>
        </div>
        <div>
          <h4>Contact us</h4>
          <p><a href={`mailto:${COMPANY.email}`} style={{ color: "inherit", fontWeight: 700 }}>{COMPANY.email}</a></p>
          <p>Replies within a few working hours. For anything else, Riya is here 24×7.</p>
          <AskButton className="btn sm" q="I need help with something">✦ Chat with Riya</AskButton>
          <address style={{ fontStyle: "normal", marginTop: 14, lineHeight: 1.6 }}>
            {COMPANY.address.lines.map((l) => <span key={l} style={{ display: "block" }}>{l}</span>)}
          </address>
        </div>
      </div>
      <div className="wrap legal">
        <p>© {new Date().getFullYear()} {COMPANY.legalName} · CIN {COMPANY.cin} · {COMPANY.brand} is a brand of {COMPANY.legalName}.</p>
      </div>
    </footer>
  );
}
