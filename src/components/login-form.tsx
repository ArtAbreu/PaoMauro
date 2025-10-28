"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { loginSchema } from "@/lib/zod-schemas";
import { signIn } from "next-auth/react";
import { toast } from "@/components/ui/use-toast";

export function LoginForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      token: "",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        token: values.token,
        redirect: false,
        callbackUrl: "/",
      });
      if (result?.error) {
        setError(result.error);
      } else if (result?.ok) {
        toast({ title: "Bem-vindo!", description: "Login realizado com sucesso." });
        window.location.href = result.url ?? "/";
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" type="email" autoComplete="email" {...form.register("email")} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input id="password" type="password" autoComplete="current-password" {...form.register("password")} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="token">Token 2FA (opcional)</Label>
        <Input id="token" type="text" placeholder="000000" inputMode="numeric" {...form.register("token")} />
      </div>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
