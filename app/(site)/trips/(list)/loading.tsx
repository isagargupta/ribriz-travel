export default function Loading() {
  return (
    <div className="wrap" aria-busy="true" aria-label="Loading trips">
      <div className="page-head"><div className="skel-line" style={{ width: 90 }} /><div className="skel-line xl" style={{ width: "40%" }} /></div>
      <div className="results" style={{ marginTop: 24 }}>
        <div className="filters desktop-only skel" style={{ height: 520 }} />
        <div className="grid">{Array.from({ length: 6 }, (_, i) => <div key={i} className="card skel" />)}</div>
      </div>
    </div>
  );
}
