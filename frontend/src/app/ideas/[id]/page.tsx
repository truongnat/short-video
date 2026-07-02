'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  Lightbulb,
  ChevronRight,
  Calendar,
  Globe,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Idea {
  id: string;
  title: string;
  description?: string;
  language?: string;
  status: string;
  script?: string;
  created_at?: string;
  updated_at?: string;
  topic?: string;
  tags?: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
    done: {
      label: 'Hoàn thành',
      icon: <CheckCircle2 size={13} />,
      cls: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/25',
    },
    completed: {
      label: 'Hoàn thành',
      icon: <CheckCircle2 size={13} />,
      cls: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/25',
    },
    generating: {
      label: 'Đang tạo',
      icon: <Loader2 size={13} className="animate-spin" />,
      cls: 'text-amber-400 bg-amber-400/10 border-amber-400/25',
    },
    pending: {
      label: 'Chờ xử lý',
      icon: <Clock size={13} />,
      cls: 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20',
    },
    draft: {
      label: 'Nháp',
      icon: <FileText size={13} />,
      cls: 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20',
    },
    error: {
      label: 'Lỗi',
      icon: <AlertCircle size={13} />,
      cls: 'text-red-400 bg-red-400/10 border-red-400/25',
    },
    failed: {
      label: 'Thất bại',
      icon: <AlertCircle size={13} />,
      cls: 'text-red-400 bg-red-400/10 border-red-400/25',
    },
  };

  const cfg = map[status] ?? {
    label: status,
    icon: <Sparkles size={13} />,
    cls: 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${cfg.cls}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded bg-zinc-800/60 animate-pulse ${className}`}
    />
  );
}

function IdeaDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* breadcrumb */}
      <SkeletonBlock className="h-4 w-48" />

      {/* header */}
      <div className="space-y-3">
        <SkeletonBlock className="h-8 w-3/4" />
        <SkeletonBlock className="h-5 w-24 rounded-full" />
      </div>

      {/* meta row */}
      <div className="flex gap-6">
        <SkeletonBlock className="h-4 w-36" />
        <SkeletonBlock className="h-4 w-28" />
      </div>

      {/* divider */}
      <div className="border-t border-zinc-800" />

      {/* description */}
      <div className="space-y-2">
        <SkeletonBlock className="h-3 w-20" />
        <SkeletonBlock className="h-4 w-full" />
        <SkeletonBlock className="h-4 w-5/6" />
      </div>

      {/* script box */}
      <div className="space-y-2">
        <SkeletonBlock className="h-3 w-20" />
        <SkeletonBlock className="h-56 w-full rounded-lg" />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function IdeaDetailPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';

  const {
    data: idea,
    isLoading,
    isError,
    error,
  } = useQuery<Idea>({
    queryKey: ['ideas', id],
    queryFn: () => api.get(`/ideas/${id}`).then((res) => res.data),
    enabled: !!id,
    retry: 1,
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">

        {/* ── Breadcrumb ── */}
        <nav className="flex items-center gap-1.5 text-sm mb-8" aria-label="Breadcrumb">
          <Link
            href="/ideas"
            className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <Lightbulb size={14} className="shrink-0" />
            <span>Ý tưởng</span>
          </Link>
          <ChevronRight size={14} className="text-zinc-600 shrink-0" />
          <span className="text-zinc-300 truncate max-w-xs">
            {isLoading ? (
              <span className="inline-block w-32 h-3.5 rounded bg-zinc-800 animate-pulse" />
            ) : (
              idea?.title ?? 'Chi tiết'
            )}
          </span>
        </nav>

        {/* ── Loading ── */}
        {isLoading && <IdeaDetailSkeleton />}

        {/* ── Error ── */}
        {isError && !isLoading && (
          <div className="rounded-xl border border-red-900/60 bg-red-950/20 p-6 flex items-start gap-3">
            <AlertCircle size={20} className="text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-red-300 font-medium">Không thể tải ý tưởng</p>
              <p className="text-red-400/70 text-sm mt-1">
                {(error as any)?.response?.data?.message ??
                  (error as any)?.message ??
                  'Đã xảy ra lỗi không xác định'}
              </p>
            </div>
          </div>
        )}

        {/* ── Idea content ── */}
        {idea && !isLoading && (
          <article className="space-y-8">

            {/* Header */}
            <header className="space-y-4">
              <div className="flex flex-wrap items-start gap-3">
                <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-100 leading-snug flex-1 min-w-0">
                  {idea.title}
                </h1>
                <StatusBadge status={idea.status} />
              </div>

              {/* Meta chips */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-400">
                {idea.language && (
                  <span className="flex items-center gap-1.5">
                    <Globe size={14} className="text-zinc-500" />
                    <span className="uppercase font-mono text-xs tracking-wider">{idea.language}</span>
                  </span>
                )}
                {idea.created_at && (
                  <span className="flex items-center gap-1.5">
                    <Calendar size={14} className="text-zinc-500" />
                    <span>{formatDate(idea.created_at)}</span>
                  </span>
                )}
              </div>

              {/* Tags */}
              {idea.tags && idea.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {idea.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </header>

            <div className="border-t border-zinc-900" />

            {/* Description */}
            {idea.description && (
              <section className="space-y-3">
                <p className="text-zinc-500 text-xs uppercase tracking-wider font-medium">Mô tả</p>
                <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{idea.description}</p>
              </section>
            )}

            {/* Topic */}
            {idea.topic && idea.topic !== idea.description && (
              <section className="space-y-3">
                <p className="text-zinc-500 text-xs uppercase tracking-wider font-medium">Chủ đề</p>
                <p className="text-zinc-300 leading-relaxed">{idea.topic}</p>
              </section>
            )}

            {/* Script */}
            {idea.script ? (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-zinc-500" />
                  <p className="text-zinc-500 text-xs uppercase tracking-wider font-medium">Kịch bản</p>
                </div>
                <div className="relative rounded-xl border border-zinc-900 bg-zinc-900/50 overflow-hidden">
                  {/* top bar */}
                  <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-zinc-800/80 bg-zinc-900">
                    <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                    <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                    <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                    <span className="ml-3 text-zinc-500 text-xs font-mono">script.txt</span>
                  </div>
                  <pre className="overflow-y-auto max-h-[28rem] p-5 text-sm text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap break-words scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                    {idea.script}
                  </pre>
                </div>
              </section>
            ) : (
              <section className="space-y-3">
                <p className="text-zinc-500 text-xs uppercase tracking-wider font-medium">Kịch bản</p>
                <div className="flex items-center gap-3 rounded-xl border border-zinc-900 bg-zinc-900/40 px-5 py-4 text-zinc-500 text-sm">
                  <FileText size={16} className="shrink-0" />
                  <span>Chưa có kịch bản cho ý tưởng này.</span>
                </div>
              </section>
            )}

            {/* Metadata card */}
            <div className="border-t border-zinc-900" />

            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <MetaField label="Trạng thái" value={<StatusBadge status={idea.status} />} />
              <MetaField
                label="Ngôn ngữ"
                value={
                  idea.language ? (
                    <span className="font-mono text-sm text-zinc-300 uppercase tracking-wider">
                      {idea.language}
                    </span>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )
                }
              />
              <MetaField label="Ngày tạo" value={<span className="text-zinc-300 text-sm">{formatDate(idea.created_at)}</span>} />
              {idea.updated_at && (
                <MetaField
                  label="Cập nhật lần cuối"
                  value={<span className="text-zinc-300 text-sm">{formatDate(idea.updated_at)}</span>}
                />
              )}
            </section>

          </article>
        )}
      </div>
    </div>
  );
}

// ─── Small helper component ───────────────────────────────────────────────────

function MetaField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-zinc-900 bg-zinc-900/30 px-4 py-3">
      <p className="text-zinc-500 text-xs uppercase tracking-wider font-medium">{label}</p>
      <div>{value}</div>
    </div>
  );
}
