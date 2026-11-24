import Image from "next/image";
import Link from "next/link";
import type { DashTrip } from "@/lib/dashboard";
import { fmtDate } from "@/lib/pricing";
import AskButton from "./AskButton";
import JourneyTrack from "./JourneyTrack";

/** A trip as a card: photo, dates, countdown, the journey track of Riya's steps, and what's next. */
export default function TripCardX({ t, i = 0 }: { t: DashTrip; i?: number }) {
  return (
    <article className="trip-x" style={{ ["--i" as string]: i }}>
      <header>
        {t.image && <Image src={t.image} alt="" fill sizes="(max-width: 800px) 100vw, 560px" />}
        <div className="trip-x-top">
          <div>
            <h3>{t.dest ?? t.title}</h3>
            <p>{t.date ? `${fmtDate(t.date)} – ${fmtDate(t.returnDate!, { day: "numeric", month: "short", year: "numeric" })}` : "Dates not chosen yet"}</p>
          </div>
          {t.daysToGo !== null && t.daysToGo >= 0 && <span className="trip-x-count">{t.daysToGo === 0 ? "Today!" : <><b>{t.daysToGo}</b> days</>}</span>}
        </div>
      </header>
      <JourneyTrack tasks={t.tasks} />
      <footer>
        <div className="trip-x-foot">
          <span>{t.needsYou ? <b className="warn-txt">● {t.needsYou} waiting for your OK</b> : <span className="muted"><b style={{ color: "var(--fg)" }}>{t.progress}%</b> sorted</span>}</span>
          <span className="trip-x-links">
            <AskButton q={`Let's continue my trip "${t.title}" (mission ${t.id}). What's next?`}>Ask Riya</AskButton>
            <Link className="btn sm" href={`/me/trips/${t.id}`}>Open</Link>
          </span>
        </div>
      </footer>
    </article>
  );
}
