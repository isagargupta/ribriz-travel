import type { Metadata } from "next";
import PlanForm from "@/components/PlanForm";

export const metadata: Metadata = {
  title: "Plan a custom trip",
  description: "Tell a Ribriz travel expert your dates and budget and get a costed holiday plan within one working day.",
};

export default function PlanPage() {
  return (
    <>
      <div className="wrap page-head">
        <span className="kicker">Custom holidays</span>
        <h1>Plan my trip</h1>
        <p>Tell us where, when and roughly how much. A travel expert will send a day-by-day plan with a full price, usually within one working day. No payment needed to ask.</p>
      </div>
      <section className="band" style={{ paddingTop: 24 }}>
        <div className="wrap" style={{ maxWidth: 820 }}><PlanForm /></div>
      </section>
    </>
  );
}
