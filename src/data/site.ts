// Single source of truth for business details used across the site.
import { PUBLIC_EMAIL } from '@/lib/public-contact.js';
import { SITE_URL } from '@/lib/site-url.js';

export const site = {
  name: 'Daybytes Tech Solutions',
  legalName: 'Daybytes Tech Solutions',
  shortName: 'Daybytes',
  url: SITE_URL,
  rcNumber: '8035192',
  tagline: 'Smart tech that keeps your business moving',
  description:
    'Daybytes Tech Solutions is an IT solutions company in Lagos, Nigeria. IT support, web development, computer repair, training and business optimization for businesses and individuals.',
  phone: { display: '+234 913 320 3892', href: 'tel:+2349133203892', e164: '+2349133203892' },
  email: PUBLIC_EMAIL,
  calendly: 'https://calendly.com/daybytestechsolutions',
  // Public form endpoints for the static site. The server route reads the actual Brevo
  // credentials from environment variables and does not expose them to the browser.
  forms: {
    contact: '/api/submit',
    training: '/api/submit',
    careers: '/api/submit',
  },
  address: {
    street: 'Lagos',
    locality: 'Lagos',
    region: 'Nigeria',
    country: 'NG',
  },
  hours: [
    { label: 'Mon to Fri', value: '08:00 to 18:00' },
    { label: 'Sat & Sun', value: 'By appointment' },
  ],
  socials: [
    { label: 'LinkedIn', href: 'https://www.linkedin.com/company/daybytes-tech-solutions/' },
    { label: 'X (Twitter)', href: 'https://x.com/daybytes_tech' },
    { label: 'TikTok', href: 'https://www.tiktok.com/@daybytes_tech' },
    { label: 'Telegram', href: 'https://t.me/Daybyte_support' },
  ],
  stats: [
    { value: 24, suffix: '/7', label: 'Support' },
    { value: 99, suffix: '%', label: 'Client satisfaction' },
    { value: 6, suffix: '+', label: 'Years of experience' },
  ],
  trustedBy: ['Businesses', 'Founders', 'Growing teams'],
} as const;

export const nav = [
  { label: 'Services', href: '/services' },
  { label: 'About', href: '/about' },
  { label: 'Blog', href: '/blog' },
  { label: 'Training', href: '/training' },
  { label: 'Careers', href: '/careers' },
  { label: 'Contact', href: '/contact' },
] as const;

export const approach = [
  { title: 'Analyze & understand', text: 'We study your processes, systems, and workflows to find gaps and improvement opportunities.' },
  { title: 'Plan strategically', text: 'We create actionable plans to boost efficiency, performance, and growth.' },
  { title: 'Implement & improve', text: 'We apply practical solutions, measure results, and refine them until they work for you.' },
] as const;
