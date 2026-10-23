'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

const SLIDES = [
  { src: '/products/radha-ka-mohan-radha-krishna-main.webp', alt: 'Radha and Krishna devotional frame', title: 'Radha & Krishna' },
  { src: '/products/jhopri-ganesha-main.webp', alt: 'Ganesha devotional frame', title: 'Lord Ganesha' },
  { src: '/products/shree-ram-janki-ram-and-sita-main.webp', alt: 'Ram Darbar devotional frame', title: 'Ram Darbar' },
];

export default function HeroSlideshow() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSlide = SLIDES[activeIndex];

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveIndex(current => (current + 1) % SLIDES.length);
    }, 2800);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div
      className="art"
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured devotional artwork"
    >
      <Image
        key={activeSlide.src}
        className="hero-main"
        src={activeSlide.src}
        alt={activeSlide.alt}
        width={1035}
        height={923}
        priority={activeIndex === 0}
        sizes="(max-width: 900px) 285px, (max-width: 1180px) 38vw, 430px"
      />
      <div className="hero-photo-note">
        <span>Featured devotional art</span>
        <b>{activeSlide.title}</b>
        <div className="hero-slide-controls" role="group" aria-label="Slideshow controls">
          {SLIDES.map((slide, index) => (
            <button
              className={`hero-slide-dot${index === activeIndex ? ' active' : ''}`}
              key={slide.src}
              type="button"
              aria-label={`Show ${slide.title}`}
              aria-pressed={index === activeIndex}
              onClick={() => setActiveIndex(index)}
            />
          ))}
        </div>
      </div>
      <div className="hero-seal" aria-hidden="true">With<br />love</div>
    </div>
  );
}
