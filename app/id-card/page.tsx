"use client";

import { useEffect, useState } from "react";
import { CreditCard, Printer, RotateCw } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { LoadingBlock, ErrorBlock } from "@/components/common/state-blocks";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiGet } from "@/lib/client/api";
import type { StudentProfile, LockerDocument } from "@/lib/api-types";

type Tab = "card" | "registration";

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function PseudoQr({ seed, size = 10 }: { seed: string; size?: number }) {
  const hash = hashString(seed);
  const cells: boolean[] = [];
  for (let i = 0; i < size * size; i++) {
    cells.push(((hash >> (i % 24)) ^ (hash << (i % 5))) % 3 === 0);
  }
  const cell = 100 / size;
  return (
    <svg viewBox="0 0 100 100" className="size-20 rounded bg-white p-1">
      {cells.map((filled, i) =>
        filled ? <rect key={i} x={(i % size) * cell} y={Math.floor(i / size) * cell} width={cell} height={cell} fill="#0f172a" /> : null,
      )}
    </svg>
  );
}

function Barcode({ seed }: { seed: string }) {
  const hash = hashString(seed);
  const bars = Array.from({ length: 28 }, (_, i) => 1 + (((hash >> (i % 20)) ^ i) % 3));
  return (
    <svg viewBox="0 0 140 28" className="h-7 w-full">
      {bars.reduce<{ x: number; els: React.ReactNode[] }>(
        (acc, w, i) => {
          acc.els.push(<rect key={i} x={acc.x} y={0} width={w} height={28} fill={i % 2 === 0 ? "#0f172a" : "transparent"} />);
          acc.x += w;
          return acc;
        },
        { x: 0, els: [] },
      ).els}
    </svg>
  );
}

export default function IdCardPage() {
  const [tab, setTab] = useState<Tab>("card");
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [photo, setPhoto] = useState<LockerDocument | null>(null);
  const [signature, setSignature] = useState<LockerDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiGet<{ profile: StudentProfile }>("/api/profile"),
      apiGet<{ documents: LockerDocument[] }>("/api/locker").catch(() => ({ documents: [] as LockerDocument[] })),
    ])
      .then(([p, l]) => {
        if (cancelled) return;
        setProfile(p.profile);
        setPhoto(l.documents.find((d) => d.category === "photo") ?? null);
        setSignature(l.documents.find((d) => d.category === "signature") ?? null);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <LoadingBlock rows={4} />;
  if (error) return <ErrorBlock message={error} />;
  if (!profile) return null;

  const validThru = `${profile.admissionYear + 4}`;

  return (
    <div className="space-y-6 print:space-y-0">
      <div className="print:hidden">
        <PageHeader title="ID Card" description="Your campus smart card and official registration form." />
        <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-muted p-0.5 text-xs">
          {([
            { key: "card", label: "Smart Card" },
            { key: "registration", label: "Registration Form" },
          ] as { key: Tab; label: string }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors",
                tab === t.key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "card" && (
        <div className="flex flex-col items-center gap-4">
          <div className="[perspective:1600px]">
            <div
              onClick={() => setFlipped((f) => !f)}
              className={cn(
                "relative h-[240px] w-[380px] cursor-pointer transition-transform duration-700 [transform-style:preserve-3d]",
                flipped && "[transform:rotateY(180deg)]",
              )}
            >
              {/* Front */}
              <div className="absolute inset-0 overflow-hidden rounded-2xl shadow-xl [backface-visibility:hidden]">
                <div className="h-full w-full bg-gradient-to-br from-[#14213D] via-[#1c2f52] to-[#2a4066] p-4 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">Central Institute of Technology</p>
                      <p className="text-xs font-medium text-white/90">Student Smart Card</p>
                    </div>
                    <CreditCard className="size-5 text-white/60" />
                  </div>
                  <div className="mt-3 flex gap-3">
                    <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/10 ring-1 ring-white/20">
                      {photo ? (
                        // eslint-disable-next-line @next/next/no-img-element -- dynamic user-uploaded file served by the backend, not a static asset
                        <img src={`/api/locker/${photo.id}/file`} alt="" className="size-full object-cover" />
                      ) : (
                        <span className="text-lg font-semibold">{profile.firstName[0]}{profile.lastName[0]}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{profile.firstName} {profile.lastName}</p>
                      <p className="text-[11px] text-white/70">{profile.rollNumber}</p>
                      <p className="mt-1 truncate text-[11px] text-white/80">{profile.programme}</p>
                      <p className="text-[11px] text-white/60">{profile.department} · Sem {profile.currentSemester}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-end justify-between border-t border-white/15 pt-2">
                    <div>
                      <p className="text-[9px] uppercase tracking-wide text-white/50">Valid thru</p>
                      <p className="text-xs font-medium">{validThru}</p>
                    </div>
                    <div className="h-5 w-20 rounded bg-gradient-to-r from-white/20 via-white/40 to-white/20" />
                  </div>
                </div>
              </div>

              {/* Back */}
              <div className="absolute inset-0 overflow-hidden rounded-2xl shadow-xl [backface-visibility:hidden] [transform:rotateY(180deg)]">
                <div className="flex h-full w-full flex-col justify-between bg-[#14213D] p-4 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[10px] leading-relaxed text-white/70">
                      This card is the property of Central Institute of Technology. If found, please return to the
                      Admission Cell. Misuse of this card is a disciplinary offence.
                    </p>
                    <PseudoQr seed={profile.rollNumber} />
                  </div>
                  <div>
                    <Barcode seed={profile.rollNumber} />
                    <p className="mt-1 text-center text-[10px] tracking-widest text-white/60">{profile.rollNumber}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setFlipped((f) => !f)} className="gap-1.5 print:hidden">
            <RotateCw className="size-3.5" /> Flip card
          </Button>
        </div>
      )}

      {tab === "registration" && (
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="card-surface space-y-4 p-6 print:border-0 print:shadow-none">
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-wide">Central Institute of Technology</p>
              <p className="text-xs text-muted-foreground">Student Registration Confirmation</p>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Field label="Name" value={`${profile.firstName} ${profile.lastName}`} />
              <Field label="Roll Number" value={profile.rollNumber} />
              <Field label="Programme" value={profile.programme} />
              <Field label="Department" value={`${profile.department} (${profile.departmentCode})`} />
              <Field label="Semester" value={String(profile.currentSemester)} />
              <Field label="Admission Year" value={String(profile.admissionYear)} />
              <Field label="Date of Birth" value={profile.dob} />
              <Field label="Gender" value={profile.gender} />
              <Field label="Email" value={profile.email} />
              <Field label="Phone" value={profile.phone} />
            </div>
            <div className="flex items-end justify-between border-t border-border pt-4">
              <div>
                <p className="text-[10px] text-muted-foreground">Student signature</p>
                {signature ? (
                  // eslint-disable-next-line @next/next/no-img-element -- dynamic user-uploaded file served by the backend, not a static asset
                  <img src={`/api/locker/${signature.id}/file`} alt="" className="mt-1 h-10 w-32 object-contain" />
                ) : (
                  <div className="mt-6 h-px w-32 bg-border" />
                )}
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground">Registrar</p>
                <div className="mt-6 h-px w-32 bg-border" />
              </div>
            </div>
          </div>
          <Button onClick={() => window.print()} className="gap-1.5 print:hidden">
            <Printer className="size-3.5" /> Print
          </Button>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
