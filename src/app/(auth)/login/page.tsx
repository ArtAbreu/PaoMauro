import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12 dark:bg-slate-950">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl lowercase text-brand">pao do mauro</CardTitle>
          <CardDescription>Sistema de organização empresarial — acesse com suas credenciais</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
          <div className="mt-6 space-y-2 text-center text-xs text-slate-500">
            <p>Precisa de ajuda? Envie um e-mail para suporte@paodomauro.com</p>
            <Link href="mailto:suporte@paodomauro.com" className="text-brand">
              Falar com o suporte
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
