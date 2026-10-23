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
  const [isPaused, setIsPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const activeSlide = SLIDES[activeIndex];
  const showPlayControl = isPaused || isFocused;

  useEffect(() => {
    if (isPaused || isHovered || isFocused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const interval = window.setInterval(() => {
      setActiveIndex(current => (current + 1) % SLIDES.length);
    }, 2800);

    return () => window.clearInterval(interval);
  }, [activeIndex, isPaused, isHovered, isFocused]);

  return (
    <div
      className="art"
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured devotional artwork"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsFocused(false);
      }}
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
          <button
            className="hero-slide-toggle"
            type="button"
            aria-label={showPlayControl ? 'Play slideshow' : 'Pause slideshow'}
            onClick={() => {
              setIsPaused(!showPlayControl);
              if (showPlayControl) setIsFocused(false);
            }}
          >
            {showPlayControl ? 'Play' : 'Pause'}
          </button>
        </div>
      </div>
      <div className="hero-seal" aria-hidden="true">With<br />love</div>
    </div>
  );
}
