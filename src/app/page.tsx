const NAV_LINKS = [
  { label: "About", href: "#about" },
  { label: "Projects", href: "#projects" },
  { label: "Skills", href: "#skills" },
  { label: "Contact", href: "#contact" },
];

const SOCIAL_LINKS = [
  { label: "GitHub", href: "https://github.com/filipstrand" },
  { label: "LinkedIn", href: "https://linkedin.com/in/filip" },
];

const PROJECTS = [
  {
    title: "Project Alpha",
    description:
      "An end-to-end ML pipeline for real-time anomaly detection on streaming data.",
    tech: ["Python", "PyTorch", "Kafka", "GCP"],
    href: "#",
  },
  {
    title: "Project Beta",
    description:
      "Full-stack web application with a FastAPI backend and Next.js frontend.",
    tech: ["TypeScript", "Next.js", "FastAPI", "PostgreSQL"],
    href: "#",
  },
  {
    title: "Project Gamma",
    description:
      "CLI tool for automating cloud infrastructure provisioning and monitoring.",
    tech: ["Go", "Terraform", "Docker", "AWS"],
    href: "#",
  },
];

const SKILLS: Record<string, string[]> = {
  ML: ["PyTorch", "TensorFlow", "scikit-learn", "Hugging Face", "MLflow"],
  Backend: ["Python", "FastAPI", "Go", "PostgreSQL", "Redis"],
  Frontend: ["TypeScript", "React", "Next.js", "Tailwind CSS"],
  Tools: ["Docker", "Kubernetes", "GCP", "Terraform", "Git"],
};

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-zinc-200 bg-background/80 backdrop-blur-sm dark:border-zinc-800">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <a href="#" className="text-sm font-semibold tracking-tight">
            Filip
          </a>
          <ul className="flex gap-6 text-sm text-zinc-500 dark:text-zinc-400">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="transition-colors hover:text-foreground"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-6">
        {/* Hero */}
        <section className="flex min-h-[70vh] flex-col justify-center py-24">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Filip
          </h1>
          <p className="mt-2 text-lg text-accent font-medium">
            ML &amp; Software Engineer
          </p>
          <p className="mt-4 max-w-lg text-zinc-600 dark:text-zinc-400">
            Building intelligent systems at the intersection of machine learning
            and software engineering.
          </p>
          <div className="mt-8 flex gap-4">
            {SOCIAL_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                {link.label}
              </a>
            ))}
          </div>
        </section>

        {/* About */}
        <section id="about" className="py-20">
          <h2 className="text-2xl font-bold tracking-tight">About</h2>
          <p className="mt-4 leading-relaxed text-zinc-600 dark:text-zinc-400">
            I&apos;m a software engineer with a focus on machine learning and
            backend systems. I enjoy building things that are fast, reliable, and
            useful — from training models to deploying them in production. When
            I&apos;m not writing code, you can find me exploring new
            technologies or contributing to open-source projects.
          </p>
        </section>

        {/* Projects */}
        <section id="projects" className="py-20">
          <h2 className="text-2xl font-bold tracking-tight">Projects</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {PROJECTS.map((project) => (
              <a
                key={project.title}
                href={project.href}
                className="group rounded-xl border border-zinc-200 p-6 transition-colors hover:border-accent/50 dark:border-zinc-800 dark:hover:border-accent/50"
              >
                <h3 className="font-semibold group-hover:text-accent transition-colors">
                  {project.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {project.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {project.tech.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* Skills */}
        <section id="skills" className="py-20">
          <h2 className="text-2xl font-bold tracking-tight">Skills</h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-2">
            {Object.entries(SKILLS).map(([category, items]) => (
              <div key={category}>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-accent">
                  {category}
                </h3>
                <ul className="mt-3 space-y-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                  {items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="border-t border-zinc-200 py-20 dark:border-zinc-800">
          <h2 className="text-2xl font-bold tracking-tight">Contact</h2>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">
            Feel free to reach out — I&apos;m always open to interesting
            conversations and opportunities.
          </p>
          <div className="mt-6 flex gap-4">
            <a
              href="mailto:hello@filip.dev"
              className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              Email
            </a>
            {SOCIAL_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                {link.label}
              </a>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-3xl px-6 py-8 text-center text-sm text-zinc-400 dark:text-zinc-600">
          &copy; {new Date().getFullYear()} Filip. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
