'use client';

import { useEffect, useState } from 'react';

const MESSAGES = [
  {
    title: <>Make it a moment <em>to remember.</em></>,
    description: 'Explore a considered collection of devotional frames, family keepsakes and Crystal Bubble designs from The Gifter’s Hub.',
  },
  {
    title: <>Give something <em>from the heart.</em></>,
    description: 'Find thoughtful devotional art and keepsakes made for the people who matter most.',
  },
  {
    title: <>Celebrate what <em>matters most.</em></>,
    description: 'Discover meaningful designs for celebrations, milestones and the little moments in between.',
  },
  {
    title: <>Keep the moments <em>close.</em></>,
    description: 'Explore frames and keepsakes that bring favourite memories and meaningful spaces together.',
  },
];

export default function HeroMessage() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const interval = window.setInterval(() => {
      setActiveIndex(current => (current + 1) % MESSAGES.length);
    }, 5000);

    return () => window.clearInterval(interval);
  }, []);

  const message = MESSAGES[activeIndex];

  return (
    <div className="hero-message" key={activeIndex}>
      <h1>{message.title}</h1>
      <p>{message.description}</p>
    </div>
  );
}
