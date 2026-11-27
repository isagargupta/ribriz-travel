import "./visa.css";

/** Visa pages share their own stylesheet and design tokens (the .vx scope). */
export default function VisaLayout({ children }: { children: React.ReactNode }) {
  return <div className="vx">{children}</div>;
}
