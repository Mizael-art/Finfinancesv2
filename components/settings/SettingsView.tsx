"use client";

import { normalizeTheme, themeById } from "@/features/theme/themes";
import Link from "next/link";
import { useEffect, useState } from "react";
import ErrorState from "@/components/ui/ErrorState";
import { Field, PrimaryButton, Select, inputClass } from "@/components/ui/FormControls";
import Toast from "@/components/ui/Toast";
import { useSettingsData } from "@/features/settings/useSettingsData";
import { FIRST_DAYS, monthRuleSentence } from "@/features/settings/viewModels";
import DataSection from "./DataSection";
import DriveSection from "./DriveSection";
import { useToast } from "@/hooks/useToast";
import { ValidationError } from "@/lib/errors";
import { getServices } from "@/services";

const Card = ({ title, children, hint }: { title: string; hint?: string; children: React.ReactNode }) => (
  <section aria-label={title} className="mb-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
    <h2 className="text-[13px] font-semibold uppercase tracking-wide text-white/35">{title}</h2>
    {hint && <p className="mt-1 text-[12px] text-white/40">{hint}</p>}
    <div className="mt-3 flex flex-col gap-4">{children}</div>
  </section>
);

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-[14px] text-white/60">{label}</span>
    <span className="min-w-0 truncate text-right text-[14px] font-medium text-white">{value}</span>
  </div>
);

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando configurações" className="flex flex-col gap-3">
      {[210, 230, 150, 130].map((h) => <div key={h} style={{ height: h }} className="animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03] motion-reduce:animate-none" />)}
    </div>
  );
}

/** Configurações: perfil, preferências, status do backup e dados. */
export default function SettingsView() {
  const { data, error, reload } = useSettingsData();
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [loaded, setLoaded] = useState(false);

  // Preenche o formulário uma vez, na primeira leitura (depois o que o usuário digita não é sobrescrito).
  useEffect(() => {
    if (data && !loaded) { setName(data.user?.name ?? ""); setEmail(data.user?.email ?? ""); setLoaded(true); }
  }, [data, loaded]);

  const nameError = name.trim() === "" ? "Informe seu nome." : "";
  const emailError = email.trim() !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? "E-mail inválido." : "";

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    setFormError("");
    if (nameError || emailError || busy) return;
    setBusy(true);
    try {
      await getServices().users.save({ name: name.trim(), email: email.trim() || undefined, avatar: data?.user?.avatar });
      toast.show("Perfil salvo.");
    } catch (err) {
      setFormError(err instanceof ValidationError ? err.message : "Não foi possível salvar agora. Tente novamente.");
    }
    setBusy(false);
  };

  const setFirstDay = async (day: number) => {
    try { await getServices().settings.update({ firstDayOfMonth: day }); toast.show("Preferência salva."); }
    catch (err) { toast.show(err instanceof ValidationError ? err.message : "Não foi possível salvar agora."); }
  };

  let body;
  if (!data && error) body = <ErrorState onRetry={reload} />;
  else if (!data) body = <Skeleton />;
  else {
    const { settings } = data;
    body = (
      <>
        {error && <div className="mb-4"><ErrorState title="Não foi possível atualizar" onRetry={reload} /></div>}

        <Card title="Perfil">
          <form onSubmit={saveProfile} noValidate className="flex flex-col gap-4">
            <Field label="Nome" error={tried ? nameError : ""}>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" aria-invalid={tried && !!nameError} className={inputClass} />
            </Field>
            <Field label="E-mail (opcional)" error={tried ? emailError : ""}>
              <input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-invalid={tried && !!emailError} className={inputClass} />
            </Field>
            {formError && <p role="alert" className="rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-[13px] text-bad-soft">{formError}</p>}
            <PrimaryButton type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar perfil"}</PrimaryButton>
            <Link href="/onboarding" className="text-center text-[13px] font-medium text-violet-300 hover:text-violet-200">Editar renda e objetivos financeiros</Link>
          </form>
        </Card>

        <Card title="Preferências">
          <Link href="/temas" className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3 transition hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400">
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold text-white">Temas</span>
              <span className="block truncate text-[13px] text-white/45">{themeById(normalizeTheme(settings.theme)).name} · {themeById(normalizeTheme(settings.theme)).mode === "claro" ? "claro" : "escuro"}</span>
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-white/30" aria-hidden><path d="m9 6 6 6-6 6" /></svg>
          </Link>
          <Row label="Moeda" value="Real brasileiro (R$)" />
          <Field label="Primeiro dia do mês" hint={monthRuleSentence(settings.firstDayOfMonth)}>
            <Select value={settings.firstDayOfMonth} onChange={(e) => setFirstDay(Number(e.target.value))}>
              {FIRST_DAYS.map((d) => <option key={d} value={d}>{d === 1 ? "Dia 1 (padrão)" : `Dia ${d}`}</option>)}
            </Select>
          </Field>
        </Card>

        <Card title="Backup">
          <DriveSection backup={settings.backup} onMessage={toast.show} />
        </Card>

        <Card title="Dados" hint="Seus dados ficam só neste aparelho, no navegador.">
          <DataSection lastExportAt={settings.backup.lastExportAt} onMessage={toast.show} />
        </Card>
      </>
    );
  }

  return (
    <main className="min-h-dvh pb-28">
      <div className="mx-auto w-full max-w-[460px] px-4 pt-6">
        <header className="mb-5"><h1 className="text-[26px] font-semibold tracking-tight text-white">Configurações</h1></header>
        {body}
      </div>
      <Toast message={toast.message} />
    </main>
  );
}
