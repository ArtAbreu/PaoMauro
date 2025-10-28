"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";

interface Overhead {
  gasCost: number;
  energyCost: number;
  waterCost: number;
  packagingCost: number;
  otherCost: number;
  unitsProduced: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
}

interface Props {
  csrf: string;
  overhead: (Overhead & { id: string }) | null;
  users: User[];
}

export default function SettingsPanel({ csrf, overhead, users }: Props) {
  const [form, setForm] = useState({
    gasCost: String(overhead?.gasCost ?? 0),
    energyCost: String(overhead?.energyCost ?? 0),
    waterCost: String(overhead?.waterCost ?? 0),
    packagingCost: String(overhead?.packagingCost ?? 0),
    otherCost: String(overhead?.otherCost ?? 0),
    unitsProduced: String(overhead?.unitsProduced ?? 1),
  });
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "user", password: "" });
  const [people, setPeople] = useState(users);

  const saveOverhead = async () => {
    const response = await fetch("/api/settings/overhead", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrf,
      },
      body: JSON.stringify({
        gasCost: Number(form.gasCost),
        energyCost: Number(form.energyCost),
        waterCost: Number(form.waterCost),
        packagingCost: Number(form.packagingCost),
        otherCost: Number(form.otherCost),
        unitsProduced: Number(form.unitsProduced),
      }),
    });
    if (!response.ok) {
      const error = await response.json();
      toast({ title: "Erro", description: error.error ?? "Falha ao salvar overhead", variant: "destructive" } as any);
      return;
    }
    toast({ title: "Overhead atualizado" });
  };

  const createUser = async () => {
    const response = await fetch("/api/settings/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrf,
      },
      body: JSON.stringify(newUser),
    });
    if (!response.ok) {
      const error = await response.json();
      toast({ title: "Erro", description: error.error ?? "Falha ao criar usuário", variant: "destructive" } as any);
      return;
    }
    const user = await response.json();
    setPeople((prev) => [user, ...prev]);
    toast({ title: "Usuário criado" });
    setNewUser({ name: "", email: "", role: "user", password: "" });
  };

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Sobrecarga de custos</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Gás</Label>
            <Input type="number" step="0.01" value={form.gasCost} onChange={(event) => setForm((prev) => ({ ...prev, gasCost: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Energia</Label>
            <Input type="number" step="0.01" value={form.energyCost} onChange={(event) => setForm((prev) => ({ ...prev, energyCost: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Água</Label>
            <Input type="number" step="0.01" value={form.waterCost} onChange={(event) => setForm((prev) => ({ ...prev, waterCost: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Embalagens</Label>
            <Input type="number" step="0.01" value={form.packagingCost} onChange={(event) => setForm((prev) => ({ ...prev, packagingCost: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Outros</Label>
            <Input type="number" step="0.01" value={form.otherCost} onChange={(event) => setForm((prev) => ({ ...prev, otherCost: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Unidades produzidas</Label>
            <Input type="number" value={form.unitsProduced} onChange={(event) => setForm((prev) => ({ ...prev, unitsProduced: event.target.value }))} />
          </div>
        </div>
        <Button onClick={saveOverhead}>Salvar overhead</Button>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Usuários</h3>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={newUser.name} onChange={(event) => setNewUser((prev) => ({ ...prev, name: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input type="email" value={newUser.email} onChange={(event) => setNewUser((prev) => ({ ...prev, email: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Senha temporária</Label>
            <Input type="password" value={newUser.password} onChange={(event) => setNewUser((prev) => ({ ...prev, password: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Perfil</Label>
            <select className="w-full rounded-md border border-slate-300 p-2" value={newUser.role} onChange={(event) => setNewUser((prev) => ({ ...prev, role: event.target.value }))}>
              <option value="user">Usuário</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
        </div>
        <Button onClick={createUser}>Criar usuário</Button>
        <div className="mt-4 space-y-2 text-sm">
          {people.map((user) => (
            <div key={user.id} className="flex items-center justify-between rounded border border-slate-200 p-3">
              <div>
                <p className="font-medium">{user.name}</p>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>
              <span className="rounded-full bg-slate-200 px-3 py-1 text-xs uppercase">{user.role}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-lg font-semibold">Power BI</h3>
        <p className="text-sm text-slate-500">Use a string de conexão read-only do banco para conectar o Power BI.</p>
        <code className="block overflow-x-auto rounded bg-slate-900 p-3 text-xs text-slate-200">
          Host=paodomauro-db.render.com;Port=5432;Database=paodomauro;User Id=readonly;Password=***;
        </code>
      </section>
    </div>
  );
}
