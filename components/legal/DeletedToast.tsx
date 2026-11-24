"use client";
import { useEffect } from "react";
import { usePrefs } from "../Prefs";

/** After an account is deleted, confirm it once on the page we land on. */
export default function DeletedToast() {
  const { toast } = usePrefs();
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("account") !== "deleted") return;
    toast(q.get("kept") ? "Your account is deleted. Confirmed bookings stay on record, as tax law requires." : "Your account and data have been deleted.", { tone: "ok" });
    window.history.replaceState(null, "", window.location.pathname);
  }, [toast]);
  return null;
}
