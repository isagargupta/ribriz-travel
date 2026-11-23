"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const SLIDES = [
  { src: "/img/hero.jpg", word: "somewhere sunny" },
  { src: "/img/hero-maldives.jpg", word: "the Maldives" },
  { src: "/img/hero-bali.jpg", word: "Bali" },
  { src: "/img/hero-kashmir.jpg", word: "Kashmir" },
  { src: "/img/hero-japan.jpg", word: "Japan" },
];

export default function Hero() {
  const [i, setI] = useState(0);
  const timer = useRef<number | undefined>(undefined);

  const start = useCallback(() => {
    window.clearInterval(timer.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    timer.current = window.setInterval(() => setI((n) => (n + 1) % SLIDES.length), 5000);
  }, []);

  useEffect(() => { start(); return () => window.clearInterval(timer.current); }, [start]);

  return (
    <section className="hero">
      <div className="hero-art" aria-hidden="true">
        {SLIDES.map((s, n) => (
          <img key={s.src} src={s.src} alt="" className={`slide ${n === i ? "on" : ""}`} fetchPriority={n === 0 ? "high" : "low"} />
        ))}
        <svg className="flight" viewBox="0 0 1440 640" preserveAspectRatio="xMidYMid slice">
          <path id="fp" d="M-80 260 C300 160 700 120 1600 60" fill="none" />
          <path d="M-80 260 C300 160 700 120 1600 60" stroke="#fff" strokeWidth="2" strokeDasharray="2 10" fill="none" opacity=".7" />
          <g>
            <path d="M0 -7 L26 0 L0 7 L5 0z M7 -2 L-2 -16 L5 -16 L16 -2z M7 2 L-2 16 L5 16 L16 2z" fill="#fff" />
            <animateMotion dur="20s" repeatCount="indefinite" rotate="auto"><mpath href="#fp" /></animateMotion>
          </g>
        </svg>
      </div>
      <div className="wrap">
        <span className="kicker" style={{ color: "#ffc531" }}>Holidays from India &amp; Europe</span>
        <h1>Your next trip is <span className="rot"><span key={i}>{SLIDES[i].word}</span></span></h1>
        <p className="lede">Flights, stays, transfers and a local guide in one honest price. Find the cheapest week, compare trips side by side, pay in easy EMIs.</p>
        <div className="hero-badges">
          <span>★ <b>4.7</b> from 38,400 travellers</span>
          <span><b>0%</b> EMI on 3 &amp; 6 months</span>
          <span><b>24×7</b> on-trip help</span>
        </div>
        <div className="hero-dots">
          {SLIDES.map((s, n) => (
            <button key={s.src} className={n === i ? "on" : ""} aria-label={`Show ${s.word}`} onClick={() => { setI(n); start(); }} />
          ))}
        </div>
      </div>
    </section>
  );
}
