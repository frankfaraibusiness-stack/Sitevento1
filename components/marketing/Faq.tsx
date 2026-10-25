// components/marketing/Faq.tsx — replaces .faq. Native <details>/
// <summary> in the original already gives free accordion behavior with
// no JS, so this stays plain HTML elements rather than a controlled
// open/close state.
const FAQS = [
  {
    q: 'Does this slow down my site?',
    a: "No. The script tag loads async and defers all work off the main thread, so it doesn't block render or affect your load time.",
    open: true,
  },
  {
    q: 'How long does setup take?',
    a: "Paste the meta tag, verify ownership, and you're logging visits within a couple of minutes. No build step, no redeploy.",
  },
  {
    q: 'Can I use this on more than one site?',
    a: 'Yes. Connect as many sites as you want and switch between them from the same dashboard, each with its own logs and overlays.',
  },
  {
    q: 'What happens to my data if I disconnect?',
    a: 'Removing the tag stops new logging immediately. You can export existing visit history and leads at any time before deleting a site.',
  },
  {
    q: 'Do I need engineering help to set this up?',
    a: "No. It's a single tag anyone with access to your site's <head> can add — most teams have it running without looping in engineering.",
  },
];

export function Faq() {
  return (
    <>
      <section className="section-heading" style={{ marginTop: 48 }}>
        <h2>Questions, answered</h2>
        <p>
          Everything teams ask before they <span className="mark">connect their first site</span>.
        </p>
      </section>
      <section className="faq">
        {FAQS.map((item) => (
          <details className="faq-item" key={item.q} open={item.open}>
            <summary>
              {item.q}
              <span className="faq-icon"></span>
            </summary>
            <p className="faq-answer">{item.a}</p>
          </details>
        ))}
      </section>
    </>
  );
}
