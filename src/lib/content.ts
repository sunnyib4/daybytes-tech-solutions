import { getCollection, render } from 'astro:content';

const byOrder = <T extends { data: { order: number } }>(a: T, b: T) => a.data.order - b.data.order;

export const getServices = async () => (await getCollection('services')).sort(byOrder);
export const getTestimonials = async () => (await getCollection('testimonials')).sort(byOrder);
export const getFaqs = async () => (await getCollection('faqs')).sort(byOrder);

export const getPosts = async () =>
  (await getCollection('blog', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );

export const getProblems = async () => (await getCollection('problems')).sort(byOrder);

/** Newest first; undated (unconfirmed) projects keep file order at the end. */
export const getProjects = async () =>
  (await getCollection('projects')).sort((a, b) => (b.data.date?.valueOf() ?? 0) - (a.data.date?.valueOf() ?? 0));

export const getPrograms = async () => (await getCollection('programs')).sort(byOrder);

export const getOpenJobs = async () =>
  (await getCollection('jobs', ({ data }) => data.open)).sort((a, b) => b.data.posted.valueOf() - a.data.posted.valueOf());

export const jobTypeLabel = { 'full-time': 'Full time', 'part-time': 'Part time', contract: 'Contract', internship: 'Internship' } as const;

export const formatLabel = (f: string) => ({ online: 'Online', 'in-person': 'In person (Lagos)', hybrid: 'Hybrid', 'online-hybrid': 'Online / Hybrid' })[f] ?? f;

export { render };

export const formatDate = (d: Date) =>
  d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
