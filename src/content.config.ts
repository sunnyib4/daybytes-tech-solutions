import { defineCollection, reference } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

const services = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/services' }),
  schema: z.object({
    title: z.string(),
    code: z.string(),
    tag: z.string(),
    order: z.number(),
    summary: z.string(),
    description: z.string().max(170),
  }),
});

const testimonials = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/testimonials' }),
  schema: z.object({
    name: z.string(),
    role: z.string(),
    order: z.number(),
    /** Service ids this testimonial relates to (shown on those service pages). */
    services: z.array(z.string()).default([]),
  }),
});

const faqs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/faqs' }),
  schema: z.object({
    question: z.string(),
    order: z.number(),
  }),
});

const team = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/team' }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      role: z.string(),
      order: z.number(),
      photo: image().optional(),
      draft: z.boolean().default(false),
    }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().max(170),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      author: z.string().default('Daybytes'),
      category: z.string(),
      image: image(),
      imageAlt: z.string(),
      draft: z.boolean().default(false),
    }),
});

/** Rotating "real problems" in the homepage hero card. */
const problems = defineCollection({
  loader: file('src/content/problems.yaml'),
  schema: z.object({
    order: z.number(),
    request: z.string(),
    service: z.string(),
    cause: z.string(),
    nextStep: z.string(),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      client: z.string(),
      service: reference('services'),
      /** Shown above the title, e.g. "Web Development · E-commerce". */
      category: z.string(),
      summary: z.string(),
      result: z.string(),
      image: image(),
      imageAlt: z.string(),
      /** Service / tech chips. */
      chips: z.array(z.string()).default([]),
      liveUrl: z.url().optional(),
      codeUrl: z.url().optional(),
      context: z.string().optional(),
      date: z.coerce.date().optional(),
      featured: z.boolean().default(false),
      /** Headline figures for the case study. Only add real, client-approved numbers. */
      metrics: z.array(z.object({ value: z.string(), label: z.string() })).default([]),
      caseStudy: z.object({
        problem: z.string(),
        approach: z.array(z.string()).min(1),
        outcome: z.string(),
        quote: z.object({ text: z.string(), name: z.string(), role: z.string() }).optional(),
      }),
    }),
});

/** Training programs (Smart Learning Solutions). The file name or `slug` is the URL. */
const programs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/programs' }),
  schema: z.object({
    title: z.string(),
    slug: z.string().optional(),
    /** Short label for the code tile, e.g. "AI". */
    code: z.string(),
    category: z.string(),
    order: z.number(),
    featured: z.boolean().default(false),
    summary: z.string(),
    /** Who it's for. */
    audience: z.array(z.string()).min(1),
    /** What you'll learn. */
    outcomes: z.array(z.string()).min(1),
    format: z.enum(['online', 'in-person', 'hybrid', 'online-hybrid']),
    level: z.string(),
    duration: z.string().optional(),
    price: z.string().optional(),
    nextStart: z.union([z.coerce.date(), z.string()]).optional(),
  }),
});

/** Careers. Only roles with `open: true` are published. */
const jobs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/jobs' }),
  schema: z.object({
    title: z.string(),
    slug: z.string().optional(),
    department: z.string(),
    location: z.string(),
    /** Fully remote roles are marked as telecommute in Google Jobs. */
    remote: z.boolean().default(false),
    type: z.enum(['full-time', 'part-time', 'contract', 'internship']),
    summary: z.string(),
    responsibilities: z.array(z.string()).min(1),
    requirements: z.array(z.string()).min(1),
    posted: z.coerce.date(),
    validThrough: z.coerce.date().optional(),
    open: z.boolean().default(false),
  }),
});

export const collections = { services, testimonials, faqs, team, blog, problems, projects, programs, jobs };
