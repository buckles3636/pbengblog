import { EntryDate } from "../../../../shared/EntryDate";
import { TagLinks } from "../../../../shared/TagLinks";
import { notFound } from "next/navigation";
import { posts } from "../../content";
import { ArticleBody } from "../../../../shared/ArticleBody";
export const dynamicParams = false;
export function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params,
    p = posts.find((p) => p.slug === slug);
  return { title: p?.title, description: p?.summary };
}
export default async function Article({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params,
    p = posts.find((p) => p.slug === slug);
  if (!p) notFound();
  return (
    <>
      <a className="status" href="/">
        ← All entries
      </a>
      <header className="article-header">
        <span className="eyebrow">{p.category}</span>
        <h1>{p.title}</h1>
        <p className="lede">{p.summary}</p>
        <EntryDate value={p.entryDate} />
        <TagLinks tags={p.tags} />
      </header>
      <ArticleBody blocks={p.blocks} />
    </>
  );
}
