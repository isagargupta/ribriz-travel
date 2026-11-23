"use client";
import { askRiya } from "../assistant/Assistant";

/** Any button that opens Riya with a question ready. */
export default function AskButton({ q, className = "btn sm", children }: { q: string; className?: string; children: React.ReactNode }) {
  return <button type="button" className={className} onClick={() => askRiya(q)}>{children}</button>;
}
