"use client";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import ApprovalCard, { type ApprovalCardData } from "../assistant/ApprovalCard";

/** Tiny celebration where the traveller tapped. */
function confetti(el: HTMLElement) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#ff5a36", "#6a4cff", "#4a86f0", "#19b37a", "#ffc23d"];
  for (let i = 0; i < 28; i++) {
    const s = document.createElement("i");
    s.className = "confetti";
    const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 110;
    s.style.setProperty("--x", `${Math.cos(a) * d}px`);
    s.style.setProperty("--y", `${Math.sin(a) * d - 40}px`);
    s.style.setProperty("--r", `${Math.random() * 720 - 360}deg`);
    s.style.background = colors[i % colors.length];
    el.appendChild(s);
    setTimeout(() => s.remove(), 1100);
  }
}

export default function NeedsYou({ cards }: { cards: ApprovalCardData[] }) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  return (
    <section className="needs" aria-labelledby="needs-h">
      <div className="needs-in" ref={box}>
        <h2 id="needs-h"><span className="needs-dot" aria-hidden="true" /> {cards.length === 1 ? "One tap from you" : `${cards.length} taps from you`}</h2>
        <p className="muted">Riya has everything ready. Nothing happens until you approve.</p>
        <div className="needs-grid">
          {cards.map((c) => (
            <ApprovalCard key={c.id} card={c} compact onDecided={(o) => { if (o.status === "done" && box.current) confetti(box.current); setTimeout(() => router.refresh(), 1400); }} />
          ))}
        </div>
      </div>
    </section>
  );
}
