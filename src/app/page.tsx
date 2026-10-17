import Link from "next/link";
import { ArrowRight, Fuel } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-20">
      <Fuel className="mb-6 size-12 text-primary" aria-hidden="true" />
      <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        B1G Fuel
      </p>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Your operations start here.
      </h1>
      <p className="mt-5 max-w-xl text-lg text-muted-foreground">
        Sign in to access B1G Fuel. Your workspace keeps your data private and
        ready for your team’s next step.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/login" className={cn(buttonVariants(), "w-full sm:w-auto")}>
          Sign in
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </main>
  );
}
