// components/marketing/HowItWorks.tsx — replaces #how-it-works .steps.
const STEPS = [
  {
    num: '01',
    title: 'Paste the tag',
    body: "Add the meta tag to your site's <head>. Any static site, CMS, or framework works.",
  },
  {
    num: '02',
    title: 'Verify ownership',
    body: "We confirm the tag is live and start logging visits the moment it's detected.",
  },
  {
    num: '03',
    title: 'Run it from the dashboard',
    body: 'Watch logs, drop in widgets, and push overlays — no redeploy needed for any of it.',
  },
];

export function HowItWorks() {
  return (
    <>
      <section className="section-heading">
        <h2>How it works</h2>
        <p>
          From paste to <span className="mark">live dashboard</span> in three steps.
        </p>
      </section>
      <section className="steps" id="how-it-works">
        {STEPS.map((s) => (
          <div className="step" key={s.num}>
            <span className="step-num">{s.num}</span>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </div>
        ))}
      </section>
    </>
  );
}
