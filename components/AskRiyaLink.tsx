"use client";
import { askRiya } from "./assistant/Assistant";

/** Inline "Riya" link that opens the chat with a planning question. */
export default function AskRiyaLink({ q = "Help me plan a trip", children = "Riya" }: { q?: string; children?: React.ReactNode }) {
  return <button type="button" className="link-btn" style={{ font: "inherit", padding: 0 }} onClick={() => askRiya(q)}>{children}</button>;
}
