import Image from "next/image";
import Link from "next/link";
import type { DashTrip } from "@/lib/dashboard";
import { fmtDate } from "@/lib/pricing";
import AskButton from "./AskButton";
import Constellation from "./Constellation";

/** A trip as a card: photo, dates, countdown, Riya's live task map, and what's next. */
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
      <Constellation tasks={t.tasks} image={t.image} label={t.title} />
      <footer>
        <div className="trip-x-bar" aria-label={`${t.progress}% done`}><i style={{ width: `${t.progress}%` }} /></div>
        <div className="trip-x-foot">
          <span>{t.needsYou ? <b className="warn-txt">{t.needsYou} waiting for your OK</b> : <>Next: <b>{t.next}</b></>}</span>
          <span className="trip-x-links">
            <AskButton q={`Let's continue my trip "${t.title}" (mission ${t.id}). What's next?`}>Ask Riya</AskButton>
            <Link className="btn sm" href={`/me/trips/${t.id}`}>Open</Link>
          </span>
        </div>
      </footer>
    </article>
  );
}
