import { getImage } from 'astro:assets';
import type { CollectionEntry } from 'astro:content';
import type { StackProject } from '@/components/projects/ProjectStack';

/** Serialisable card data (with optimised images) for the <ProjectStack> island. */
export async function toStackProjects(entries: CollectionEntry<'projects'>[]): Promise<StackProject[]> {
  return Promise.all(
    entries.map(async ({ id, data }) => {
      const img = await getImage({ src: data.image, widths: [640, 1000, 1400], format: 'webp' });
      return {
        id,
        href: `/projects/${id}`,
        title: data.title,
        client: data.client,
        category: data.category,
        summary: data.summary,
        chips: data.chips,
        liveUrl: data.liveUrl,
        image: {
          src: img.src,
          srcSet: img.srcSet.attribute,
          sizes: '(min-width: 1148px) 1036px, 94vw',
          width: data.image.width,
          height: data.image.height,
          alt: data.imageAlt,
        },
      };
    }),
  );
}
