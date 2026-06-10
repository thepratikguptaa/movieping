"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Bell, Sparkles, MonitorPlay, Layers } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/footer";

const FEATURES = [
  { icon: Bell, title: "Theatrical release alerts", desc: "Get a push the moment a waitlisted movie hits theaters." },
  { icon: MonitorPlay, title: "OTT streaming alerts", desc: "Pinged again when a movie or web series lands on Netflix, Prime & more." },
  { icon: Layers, title: "New-season alerts", desc: "Track a series and we'll tell you the instant a new season starts streaming." },
  { icon: Sparkles, title: "Personalized", desc: "Movie & series picks tuned to your genres & languages." },
];

export default function Landing() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-brand-dark/30 via-background to-background" />
      <header className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="MoviePing" className="h-7 w-7" />
          <span className="text-xl font-bold">Movie<span className="text-primary">Ping</span></span>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" asChild><Link href="/login">Log in</Link></Button>
          <Button asChild><Link href="/signup">Sign up</Link></Button>
        </div>
      </header>

      <section className="container flex flex-col items-center pt-20 pb-16 text-center md:pt-32">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl text-4xl font-extrabold tracking-tight md:text-6xl"
        >
          Never miss a movie or <span className="text-primary">web series</span> — in theaters or on <span className="text-primary">streaming</span>.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-6 max-w-xl text-lg text-muted-foreground"
        >
          Waitlist the movies and series you&apos;re excited about. MoviePing pings
          you when a movie hits theaters, when anything lands on OTT, and when your
          series gets a new season — zero FOMO, personalized to your taste.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-8 flex gap-3"
        >
          <Button size="lg" asChild><Link href="/signup">Get started — free</Link></Button>
          <Button size="lg" variant="outline" asChild><Link href="/login">I have an account</Link></Button>
        </motion.div>

        <div className="mt-20 grid w-full max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }}
              className="rounded-xl border border-border bg-card/50 p-6 text-left"
            >
              <f.icon className="h-8 w-8 text-primary" />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}
