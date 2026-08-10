/**
 * Placeholder body for screens whose real content arrives in a later story.
 * Renders static copy only — no data, so nothing can surface as NaN or an
 * invalid date.
 */
export default function PagePlaceholder({
  title,
  description,
  comingSoon = true,
}: {
  title: string;
  description: string;
  comingSoon?: boolean;
}) {
  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">{description}</p>

      {comingSoon ? (
        <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-700">Coming soon</p>
        </div>
      ) : null}
    </section>
  );
}
