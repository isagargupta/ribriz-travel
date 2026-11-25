"use client";

export default function PrintButton() {
  return <button type="button" className="btn hot sm" onClick={() => window.print()}>Print or save PDF</button>;
}
