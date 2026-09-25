import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <LoginForm initialError={error ? "Sign-in failed. Please try again." : undefined} />
    </main>
  );
}
