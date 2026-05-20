import { Helmet } from "react-helmet-async";

export interface SeoProps {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article" | "product";
  image?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const BASE = "https://pay-palooza-go.lovable.app";

export default function Seo({ title, description, path, type = "website", image, jsonLd }: SeoProps) {
  const url = `${BASE}${path}`;
  const ogImage = image ?? "https://storage.googleapis.com/gpt-engineer-file-uploads/LSsA7Tbe5GOQalDLwipIpE2r3cb2/social-images/social-1773562722041-photo_2026-03-02_15-11-13.webp";
  const ldArray = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={ogImage} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      {ldArray.map((ld, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(ld)}</script>
      ))}
    </Helmet>
  );
}
