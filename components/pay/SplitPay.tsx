"use client";
import { useState } from "react";
import CopyLink from "../CopyLink";
import PayButton from "./PayButton";

/** Group trips: pay one traveller's share, and send the same page to the others. */
export default function SplitPay({ refCode, token, share, travellers, shareLabel, pagePath }: { refCode: string; token: string | null; share: number; travellers: number; shareLabel: string; pagePath: string }) {
  const [name, setName] = useState("");
  return (
    <div className="split">
      <b>Splitting the cost?</b>
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>Each of the {travellers} travellers can pay their own share of {shareLabel} from this page. Send them the link; their payments show up here.</p>
      <div className="split-row">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" aria-label="Your name" maxLength={80} />
        <CopyLink path={pagePath} label="Copy link for the group" title="Pay your share of our trip" />
      </div>
      <PayButton refCode={refCode} token={token} share payerName={name} secondary label={`Pay one share: ${shareLabel}`} />
    </div>
  );
}
