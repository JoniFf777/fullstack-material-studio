export function Avatar({ name, className = "size-9 text-sm" }: { name: string; className?: string }) {
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? "?";
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-full bg-lime-400/15 font-semibold text-brand ${className}`}>
      {initial}
    </span>
  );
}
