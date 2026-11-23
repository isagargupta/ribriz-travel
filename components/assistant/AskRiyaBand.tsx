"use client";
import { askRiya } from "./Assistant";

const PROMPTS = [
  "Cheapest trip in the next 3 weeks with visa on arrival",
  "Beach holiday under ₹70,000 per person",
  "Where can I go visa-free for a long weekend?",
];

/** Home-page invitation to the AI assistant. */
export default function AskRiyaBand() {
  return (
    <div className="ask-band">
      <div className="ask-copy">
        <span className="ai-avatar big" aria-hidden="true">R</span>
        <div>
          <h2>Not sure where to go? Ask Riya.</h2>
          <p>Our AI travel assistant searches every trip, date and price for you, and checks visas for your passport. Try:</p>
        </div>
      </div>
      <div className="ask-chips">
        {PROMPTS.map((p) => <button key={p} onClick={() => askRiya(p)}>{p} <span aria-hidden="true">→</span></button>)}
        <button className="ask-open" onClick={() => askRiya()}>Ask your own question</button>
      </div>
    </div>
  );
}
