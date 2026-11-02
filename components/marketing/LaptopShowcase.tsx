'use client';

import { useEffect, useRef } from 'react';

export function LaptopShowcase() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const screen = root.querySelector<HTMLElement>('.screen');
    const hint = root.querySelector<HTMLElement>('.hint');
    const cursor = root.querySelector<HTMLElement>('.fake-cursor');
    const ring = root.querySelector<HTMLElement>('.click-ring');
    const chatBtn = root.querySelector<HTMLElement>('.chat-bubble-btn');
    const card2 = root.querySelector<HTMLElement>('#card2');
    const card3 = root.querySelector<HTMLElement>('#card3');
    if (!screen || !cursor || !ring || !chatBtn || !card2 || !card3) return;

    let cancelled = false;
    const wait = (ms: number) => new Promise<void>((resolve) => {
      window.setTimeout(resolve, ms);
    });
    const position = (element: HTMLElement) => {
      const a = element.getBoundingClientRect();
      const b = screen.getBoundingClientRect();
      return { x: a.left - b.left + a.width / 2, y: a.top - b.top + a.height / 2 };
    };
    const moveCursor = (x: number, y: number) => {
      cursor.style.transform = `translate(${x}px, ${y}px)`;
    };
    const clickAt = (x: number, y: number) => {
      ring.style.left = `${x}px`;
      ring.style.top = `${y}px`;
      ring.classList.remove('fire');
      void ring.offsetWidth;
      ring.classList.add('fire');
    };
    const resetCycle = () => {
      screen.classList.remove('loaded');
      root.querySelectorAll('.mini-card').forEach((card) => card.classList.remove('active'));
      cursor.style.opacity = '0';
      moveCursor(20, 20);
      if (hint) hint.style.opacity = '1';
    };

    const playSequence = async () => {
      while (!cancelled) {
        screen.classList.add('loaded');
        if (hint) hint.style.opacity = '0';
        await wait(500);
        if (cancelled) break;

        for (const [card, pause] of [[card2, 1400], [card3, 1300]] as const) {
          const p = position(card);
          moveCursor(p.x, p.y);
          await wait(650);
          if (cancelled) break;
          clickAt(p.x, p.y);
          card.classList.add('active');
          await wait(pause);
          card.classList.remove('active');
        }
        if (cancelled) break;

        const p = position(chatBtn);
        moveCursor(p.x, p.y);
        await wait(650);
        if (cancelled) break;
        clickAt(p.x, p.y);
        await wait(1200);
        await wait(600);
        cursor.style.opacity = '0';
        await wait(500);
        resetCycle();
        await wait(900);
      }
    };

    resetCycle();
    const start = window.setTimeout(() => { void playSequence(); }, 3000);
    return () => {
      cancelled = true;
      window.clearTimeout(start);
    };
  }, []);

  return (
    <section className="sv-laptop-demo" ref={rootRef} aria-label="Website building animation">
      <div className="stage">
        <div className="laptop">
          <div className="screen-wrap">
            <div className="screen">
              <div className="progress-track"><div className="progress-fill" /></div>
              <div className="browser-bar">
                <div className="traffic"><span /><span /><span /></div>
                <div className="addr-field">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a5 5 0 0 1 5 5v3h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h1V7a5 5 0 0 1 5-5z" /></svg>
                  <span className="addr-text"><span className="proto">https://</span><span className="typed">sitevento.com</span><span className="caret" /></span>
                </div>
                <div className="reload-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v6h-6" /></svg>
                </div>
              </div>

              <div className="loading-layer">
                <div className="page-area">
                  <div className="load-row big" />
                  <div className="load-row w-70" />
                  <div className="load-row w-55" />
                  <div className="load-row w-30" />
                  <div className="block-grid"><div className="card" /><div className="card" /><div className="card" /></div>
                </div>
              </div>

              <div className="site-layer">
                <div className="announce-bar"><span className="ico">✦</span>Launch week — 30% off every plan, first 3 months</div>
                <div className="site-nav">
                  <div className="site-logo"><span className="dot" />sitevento</div>
                  <div className="site-links"><span>Shop</span><span>Studio</span><span>About</span></div>
                  <div className="site-cta-btn">Get started</div>
                </div>
                <div className="site-hero">
                  <div className="site-tag">New collection</div>
                  <div className="site-h1">Plants that make small spaces feel alive</div>
                  <div className="site-sub">Hand-picked greenery, delivered in pots you'll actually want on display.</div>
                  <div className="site-btns"><div className="site-btn-primary">Shop now</div><div className="site-btn-secondary">Take the quiz</div></div>
                </div>
                <div className="site-strip">
                  <div className="mini-card" id="card1"><div className="mini-ico" /><div className="mini-line w-80" /><div className="mini-line w-55" /><div className="card-pop"><strong>Fast delivery</strong>Arrives in 48 hours, plant-safe packaging.</div></div>
                  <div className="mini-card" id="card2"><div className="mini-ico" /><div className="mini-line w-80" /><div className="mini-line w-55" /><div className="card-pop"><strong>Care guides</strong>Step-by-step watering &amp; light tips.</div></div>
                  <div className="mini-card" id="card3"><div className="mini-ico" /><div className="mini-line w-80" /><div className="mini-line w-55" /><div className="card-pop"><strong>Easy returns</strong>30-day happiness guarantee.</div></div>
                </div>
                <div className="chat-widget">
                  <div className="chat-preview">Hi 👋 need help picking a plant?</div>
                  <div className="chat-bubble-btn"><span className="ping" /><svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-8.4 8.4A8.3 8.3 0 0 1 8 18.8L3 20l1.3-4.7A8.4 8.4 0 1 1 21 11.5z" /></svg></div>
                </div>
              </div>
              <div className="click-ring" />
              <div className="fake-cursor"><svg viewBox="0 0 24 24" fill="white" stroke="#2d1b5e" strokeWidth="1"><path d="M4 2l14 7.5-6 1.5-1.5 6z" /></svg></div>
            </div>
          </div>
          <div className="base" />
        </div>
        <div className="shadow-pool" />
        <div className="hint"><span className="pulse-dot" />Building your site…</div>
      </div>
    </section>
  );
}
