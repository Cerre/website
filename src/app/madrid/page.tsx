import Link from "next/link";
import Image from "next/image";

const photos = [
  { src: "/madrid/1.jpg", alt: "Walking the streets of Madrid" },
  { src: "/madrid/2.jpg", alt: "Rooftop views over Madrid" },
  { src: "/madrid/3.jpg", alt: "Rooftop bar with the crew" },
  { src: "/madrid/4.jpg", alt: "Lunch on the rooftop" },
  { src: "/madrid/5.jpg", alt: "Chilling on the rooftop" },
  { src: "/madrid/6.jpg", alt: "Late night at 3:14" },
];

export default function MadridPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link
          href="/"
          className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← Home
        </Link>

        <h1 className="mt-6 text-2xl font-bold tracking-tight">Madrid</h1>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {photos.map((photo) => (
            <div
              key={photo.src}
              className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800"
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                width={800}
                height={1000}
                className="w-full object-cover"
              />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
