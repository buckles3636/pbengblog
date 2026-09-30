import { posts } from "../content";
import { site } from "../site.config";
export const dynamic = "force-static";
export default function sitemap() {
  return [
    { url: site.url },
    ...posts.map((p) => ({
      url: `${site.url}/${p.slug}`,
      lastModified: p.updatedAt,
    })),
  ];
}
