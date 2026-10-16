import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Numbered project cards that stack on scroll: each card sticks a little lower
 * than the one before, and the cards underneath shrink slightly as the stack
 * grows. Phones get a plain list (revealed by src/scripts/motion.ts) and
 * prefers-reduced-motion gets no sticky or scaling at all.
 */

export interface StackProject {
  id: string;
  href: string;
  title: string;
  client: string;
  category: string;
  summary: string;
  chips: string[];
  liveUrl?: string;
  image: { src: string; srcSet: string; sizes: string; width: number; height: number; alt: string };
}

interface Props {
  projects: StackProject[];
  headingLevel?: 'h2' | 'h3';
  showFilters?: boolean;
}

const STEP_PX = 24; // each card sticks this much lower than the previous one
const SHRINK_PER_CARD = 0.045;

function useIsDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return desktop;
}

function Card({
  project,
  index,
  total,
  progress,
  animate,
  Heading,
}: {
  project: StackProject;
  index: number;
  total: number;
  progress: MotionValue<number>;
  animate: boolean;
  Heading: 'h2' | 'h3';
}) {
  const lane = useRef<HTMLLIElement>(null);
  // Card shrinks from 1 to its target over the rest of the section; earlier cards end smaller.
  const targetScale = 1 - (total - 1 - index) * SHRINK_PER_CARD;
  const scale = useTransform(progress, [index / total, 1], [1, targetScale]);
  // Screenshot settles from a slight zoom as the card arrives.
  const { scrollYProgress: arrival } = useScroll({ target: lane, offset: ['start end', 'start start'] });
  const imageScale = useTransform(arrival, [0, 1], [1.14, 1]);

  const number = String(index + 1).padStart(2, '0');
  const { image } = project;

  return (
    <li
      ref={lane}
      className="motion-safe:md:sticky motion-safe:md:h-[85vh] motion-safe:md:pt-0"
      style={{ top: `calc(1.5rem + ${index * STEP_PX}px)` }}
    >
      <motion.article
        style={animate ? { scale, transformOrigin: 'top center' } : undefined}
        className="group relative flex flex-col gap-5 rounded-[28px] border border-line bg-surface p-5 shadow-[0_-12px_40px_rgba(26,23,20,0.07)] sm:p-7 md:rounded-[36px] md:p-8 dark:shadow-[0_-12px_40px_rgba(0,0,0,0.45)]"
      >
        <header className="flex flex-wrap items-start gap-x-5 gap-y-3">
          <span aria-hidden="true" className="font-serif text-[44px] leading-[0.9] font-bold text-accent-text md:text-[64px]">
            {number}
          </span>
          <div className="min-w-0 flex-1 basis-[240px]">
            <p className="m-0 font-mono text-xs tracking-[0.08em] text-subtle uppercase">
              <span className="sr-only">Project {number}: </span>
              {project.category}
            </p>
            <Heading className="heading-serif mt-1.5 mb-0 text-[26px] leading-tight md:text-[34px]">
              <a href={project.href} className="no-underline after:absolute after:inset-0 after:rounded-[inherit] hover:underline hover:decoration-accent hover:decoration-2 hover:underline-offset-4">
                {project.title}
              </a>
            </Heading>
            <p className="mt-1 mb-0 font-mono text-[13px] text-subtle">{project.client}</p>
          </div>
          <div className="relative z-10 flex flex-wrap items-center gap-2">
            {project.liveUrl && (
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-ink px-4 py-2 font-mono text-[13px] text-ink no-underline transition-colors hover:bg-ink hover:text-surface"
              >
                Live site <span aria-hidden="true">↗</span>
                <span className="sr-only">for {project.title} (opens the client's website)</span>
              </a>
            )}
            <a href={project.href} className="btn-accent gap-2 rounded-full px-4 py-2 font-mono text-[13px] font-normal">
              View project <span className="arrow" aria-hidden="true">→</span>
              <span className="sr-only">: {project.title}</span>
            </a>
          </div>
        </header>

        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-10">
          <p className="m-0 max-w-[62ch] text-[15px] leading-relaxed text-muted md:text-base">{project.summary}</p>
          {project.chips.length > 0 && (
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0 md:justify-end" aria-label="Services">
              {project.chips.map((chip) => (
                <li key={chip} className="rounded-full border border-line-strong px-3 py-1 font-mono text-xs whitespace-nowrap text-body">
                  {chip}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="overflow-hidden rounded-[18px] border border-line bg-placeholder md:h-[clamp(220px,calc(100vh-380px),470px)] md:rounded-[22px]">
          <motion.img
            src={image.src}
            srcSet={image.srcSet}
            sizes={image.sizes}
            width={image.width}
            height={image.height}
            alt={image.alt}
            loading="lazy"
            decoding="async"
            style={animate ? { scale: imageScale } : undefined}
            className="block aspect-[16/10] w-full object-cover object-top md:aspect-auto md:h-full"
          />
        </div>
      </motion.article>
    </li>
  );
}

export default function ProjectStack({ projects, headingLevel = 'h3', showFilters = false }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const desktop = useIsDesktop();
  const animate = desktop && !reduced;
  const filterLabels = ['All', 'Ecommerce', 'Corporate', 'AI'] as const;
  const [activeFilter, setActiveFilter] = useState<(typeof filterLabels)[number]>('All');

  const visibleProjects = useMemo(() => {
    if (!showFilters || activeFilter === 'All') return projects;

    return projects.filter((project) => {
      if (activeFilter === 'Ecommerce') return project.category.includes('Ecommerce');
      if (activeFilter === 'Corporate') return project.category.includes('Corporate');
      if (activeFilter === 'AI') return project.category.includes('AI');
      return true;
    });
  }, [activeFilter, projects, showFilters]);

  const { scrollYProgress } = useScroll({ target: container, offset: ['start start', 'end end'] });
  // Thin progress line along the top of the window while the stack is on screen.
  const lineOpacity = useTransform(scrollYProgress, [0, 0.02, 0.97, 1], [0, 1, 1, 0]);

  return (
    <div ref={container} className="relative">
      {showFilters && (
        <div className="mb-6 flex flex-wrap gap-2" aria-label="Project categories">
          {filterLabels.map((filter) => (
            <button
              key={filter}
              type="button"
              data-active={activeFilter === filter}
              onClick={() => setActiveFilter(filter)}
              aria-pressed={activeFilter === filter}
              className="rounded-full border border-line-strong bg-surface px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-subtle transition-colors hover:text-ink data-[active=true]:border-accent data-[active=true]:bg-accent/10 data-[active=true]:text-accent"
            >
              {filter}
            </button>
          ))}
        </div>
      )}
      {animate && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[3px] origin-left bg-accent"
          style={{ scaleX: scrollYProgress, opacity: lineOpacity }}
        />
      )}
      <ol data-stack data-reveal-stagger className="m-0 flex list-none flex-col gap-6 p-0 motion-safe:md:gap-0">
        {visibleProjects.map((project, i) => (
          <Card key={project.id} project={project} index={i} total={visibleProjects.length} progress={scrollYProgress} animate={animate} Heading={headingLevel} />
        ))}
      </ol>
    </div>
  );
}
