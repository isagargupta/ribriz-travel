"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { DepartureDTO, TripDTO } from "@/lib/types";
import { quote, type Quote } from "@/lib/pricing";
import { usePrefs } from "../Prefs";

interface Booking {
  trip: TripDTO;
  departures: DepartureDTO[];
  selected: DepartureDTO | null;
  select: (id: string) => void;
  q: Quote | null;
  checkout: boolean;
  setCheckout: (v: boolean) => void;
  question: boolean;
  setQuestion: (v: boolean) => void;
}

const Ctx = createContext<Booking | null>(null);

export function BookingProvider({ trip, departures, initialDate, children }: {
  trip: TripDTO; departures: DepartureDTO[]; initialDate?: string; children: React.ReactNode;
}) {
  const { from, adults, childAges, addRecent } = usePrefs();
  const first = (initialDate && departures.find((d) => d.date >= initialDate)) || departures[0] || null;
  const [selId, setSelId] = useState<string | null>(first?.id ?? null);
  const [checkout, setCheckout] = useState(false);
  const [question, setQuestion] = useState(false);

  useEffect(() => { addRecent(trip.id); }, [trip.id, addRecent]);

  const selected = departures.find((d) => d.id === selId) ?? null;
  const q = useMemo(
    () => (selected ? quote({ base: trip.price, delta: selected.priceDelta, flight: trip.flight, from, adults, childAges }) : null),
    [selected, trip.price, trip.flight, from, adults, childAges],
  );

  const value = { trip, departures, selected, select: setSelId, q, checkout, setCheckout, question, setQuestion };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBooking() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useBooking must be used inside BookingProvider");
  return c;
}
