'use client';

import { useEffect, useState } from 'react';

const REVIEWS = [
  'Customers mention the range of art gifts and the helpful, polite service.',
  'Reviewers praise the quality and finishing of the products.',
  'Customers appreciate the decorative picture and scenery designs.',
];

export default function GoogleReviewsCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (paused || hovered || focused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const interval = window.setInterval(() => {
      setActiveIndex(index => (index + 1) % REVIEWS.length);
    }, 5500);
    return () => window.clearInterval(interval);
  }, [activeIndex, paused, hovered, focused]);

  return (
    <section className="google-reviews" aria-labelledby="google-reviews-heading">
      <div className="google-reviews-intro">
        <span className="eyebrow">CUSTOMER FEEDBACK · GOOGLE</span>
        <h2 id="google-reviews-heading">A little love from our customers.</h2>
        <p>Paraphrased summaries of public Google reviews. Read the original feedback on Google.</p>
        <a href="https://www.google.com/maps/search/?api=1&query=The+Gifter%27s+Hub+Jai+Vihar+New+Delhi" target="_blank" rel="noreferrer">
          Read Google reviews <span aria-hidden="true">↗</span>
        </a>
      </div>
      <div
        className="google-review-carousel"
        role="region"
        aria-roledescription="carousel"
        aria-label="Google customer feedback summaries"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
        }}
      >
        <article className="google-review-card" key={activeIndex} aria-label={`Feedback ${activeIndex + 1} of ${REVIEWS.length}`}>
          <span className="google-review-mark" aria-hidden="true">“</span>
          <p>{REVIEWS[activeIndex]}</p>
          <div><span className="google-review-source" aria-hidden="true">G</span><span>Google customer review · summary</span></div>
        </article>
        <div className="google-review-controls" role="group" aria-label="Review carousel controls">
          {REVIEWS.map((review, index) => (
            <button
              key={review}
              type="button"
              aria-label={`Show customer feedback ${index + 1}`}
              aria-pressed={index === activeIndex}
              className={index === activeIndex ? 'active' : ''}
              onClick={() => setActiveIndex(index)}
            />
          ))}
          <button
            className="google-review-toggle"
            type="button"
            onClick={() => setPaused(value => !value)}
            aria-label={paused ? 'Play customer feedback carousel' : 'Pause customer feedback carousel'}
          >
            {paused ? 'Play' : 'Pause'}
          </button>
        </div>
      </div>
    </section>
  );
}
