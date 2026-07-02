"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ChevronRight,
  Download,
  Copy,
  RefreshCw,
  CheckCheck,
  Film,
  ExternalLink,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useState, useRef } from "react";
import api from "@/lib/api";
import {
  backendVideoStreamUrl,
  backendVideoSubtitleUrl,
  backendVideoThumbnailUrl,
} from "@/lib/backend-media";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VideoJob {
  id: string;
  status: string;
  progress: number;
}

interface VideoIdea {
  title: string;
}

interface Video {
  id: string;
  title: string;
  script?: string;
  ratio: string;
  createdAt: string;
  videoUrl: string;
  thumbnailUrl?: string;
  subtitleUrl?: string;
  videoObjectKey?: string;
  idea?: VideoIdea;
  job?: VideoJob;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchVideo(id: string): Promise<Video> {
  const { data } = await api.get<Video>(`/videos/${id}`);
  return data;
}

async function regenerateVideo(id: string): Promise<any> {
  const { data } = await api.post(`/videos/${id}/regenerate`);
  return data;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-zinc-800 ${className}`}
      aria-hidden="true"
    />
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Player */}
      <div className="flex-1">
        <Skeleton className="aspect-video w-full rounded-xl" />
      </div>

      {/* Panel */}
      <div className="flex w-full flex-col gap-4 lg:w-80 xl:w-96">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-48" />
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 flex-1" />
        </div>
      </div>
    </div>
  );
}

// ─── Ratio badge ──────────────────────────────────────────────────────────────

function RatioBadge({ ratio }: { ratio: string }) {
  const label =
    ratio === "9:16"
      ? "Portrait 9:16"
      : ratio === "16:9"
        ? "Landscape 16:9"
        : ratio === "1:1"
          ? "Square 1:1"
          : ratio;

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-300">
      <Film size={11} />
      {label}
    </span>
  );
}

// ─── Job status badge ─────────────────────────────────────────────────────────

function JobStatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    completed: "border-emerald-800 bg-emerald-950 text-emerald-400",
    failed: "border-red-800 bg-red-950 text-red-400",
    pending: "border-yellow-800 bg-yellow-950 text-yellow-400",
    running: "border-blue-800 bg-blue-950 text-blue-400",
  };
  const cls =
    variants[status.toLowerCase()] ??
    "border-zinc-700 bg-zinc-800 text-zinc-400";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${cls}`}
    >
      {status}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VideoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [copied, setCopied] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // ── Fetch video ──
  const {
    data: video,
    isLoading,
    isError,
    error,
  } = useQuery<Video, Error>({
    queryKey: ["video", id],
    queryFn: () => fetchVideo(id),
    enabled: !!id,
    staleTime: 30_000,
  });

  // ── Regenerate mutation ──
  const regenerateMutation = useMutation({
    mutationFn: () => regenerateVideo(id),
    onSuccess: (newJob) => {
      if (newJob?.id) {
        router.push(`/jobs/${newJob.id}`);
      } else {
        router.push('/jobs');
      }
    },
  });

  // ── Copy URL ──
  async function handleCopyUrl() {
    if (!video?.id) return;
    await navigator.clipboard.writeText(backendVideoStreamUrl(video.id));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Determine player aspect ratio class ──
  function playerAspect(ratio: string) {
    if (ratio === "9:16") return "aspect-[9/16] max-h-[70vh]";
    if (ratio === "1:1") return "aspect-square max-h-[70vh]";
    return "aspect-video";
  }

  const proxiedVideoUrl = video ? backendVideoStreamUrl(video.id) : undefined;
  const proxiedThumbnailUrl =
    video?.thumbnailUrl && video ? backendVideoThumbnailUrl(video.id) : undefined;
  const proxiedSubtitleUrl =
    video?.subtitleUrl && video ? backendVideoSubtitleUrl(video.id) : undefined;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">

        {/* ── Breadcrumb ── */}
        <nav
          aria-label="Breadcrumb"
          className="mb-6 flex items-center gap-1.5 text-sm text-zinc-500"
        >
          <Link
            href="/videos"
            className="transition-colors hover:text-zinc-200"
          >
            Thư viện Video
          </Link>
          <ChevronRight size={14} className="shrink-0 text-zinc-700" />
          <span className="max-w-xs truncate text-zinc-300">
            {isLoading ? "…" : (video?.title ?? "Video")}
          </span>
        </nav>

        {/* ── Error state ── */}
        {isError && (
          <div className="flex items-center gap-3 rounded-xl border border-red-900 bg-red-950/40 px-5 py-4 text-red-400">
            <AlertCircle size={18} className="shrink-0" />
            <p className="text-sm">
              {error?.message ?? "Không thể tải video. Vui lòng thử lại."}
            </p>
          </div>
        )}

        {/* ── Loading skeleton ── */}
        {isLoading && <DetailSkeleton />}

        {/* ── Content ── */}
        {video && (
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start">

            {/* ── LEFT: Video player ── */}
            <div className="flex-1">
              <div
                className={`relative mx-auto w-full overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-900 shadow-2xl ${playerAspect(video.ratio)}`}
              >
                <video
                  ref={videoRef}
                  src={proxiedVideoUrl}
                  poster={proxiedThumbnailUrl}
                  controls
                  autoPlay
                  playsInline
                  crossOrigin="anonymous"
                  preload="metadata"
                  className="h-full w-full object-contain"
                  aria-label={`Video: ${video.title}`}
                >
                  {proxiedSubtitleUrl && (
                    <track
                      kind="subtitles"
                      src={proxiedSubtitleUrl}
                      default
                      label="Subtitles"
                    />
                  )}
                  Trình duyệt của bạn không hỗ trợ phát video.
                </video>

                {/* Ratio badge overlay */}
                <div className="absolute left-3 top-3">
                  <RatioBadge ratio={video.ratio} />
                </div>
              </div>
            </div>

            {/* ── RIGHT: Metadata panel ── */}
            <aside className="flex w-full flex-col gap-5 lg:w-80 xl:w-96">

              {/* Title */}
              <div>
                <h1 className="text-xl font-semibold leading-snug text-zinc-100">
                  {video.title}
                </h1>
                {video.idea?.title && video.idea.title !== video.title && (
                  <p className="mt-1 text-sm text-zinc-500">
                    Ý tưởng: {video.idea.title}
                  </p>
                )}
              </div>

              {/* Meta rows */}
              <div className="flex flex-col gap-2 rounded-xl border border-zinc-900 bg-zinc-900/60 px-4 py-3">
                {/* Created at */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Ngày tạo</span>
                  <span className="font-medium text-zinc-300">
                    {new Date(video.createdAt).toLocaleString('vi-VN')}
                  </span>
                </div>

                {/* Ratio */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Tỷ lệ</span>
                  <RatioBadge ratio={video.ratio} />
                </div>

                {/* Job link */}
                {video.job && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Job</span>
                    <div className="flex items-center gap-2">
                      <JobStatusBadge status={video.job.status} />
                      <Link
                        href={`/jobs/${video.job.id}`}
                        className="inline-flex items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
                      >
                        Xem job
                        <ExternalLink size={11} />
                      </Link>
                    </div>
                  </div>
                )}

                {/* Progress (if running) */}
                {video.job &&
                  video.job.status.toLowerCase() === "running" && (
                    <div className="mt-1">
                      <div className="mb-1 flex justify-between text-xs text-zinc-500">
                        <span>Tiến trình</span>
                        <span>{video.job.progress}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all duration-500"
                          style={{ width: `${video.job.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
              </div>

              {/* Script */}
              {video.script && (
                <div>
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Nội dung kịch bản
                  </h2>
                  <div className="max-h-56 overflow-y-auto rounded-xl border border-zinc-900 bg-zinc-900/60 px-4 py-3 text-sm leading-relaxed text-zinc-300 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                    <p className="whitespace-pre-wrap">{video.script}</p>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-col gap-2 pt-1 sm:flex-row lg:flex-col xl:flex-row">

                {/* Download */}
                <a
                  href={proxiedVideoUrl}
                  download={`${video.title}.mp4`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-all hover:border-zinc-700 hover:bg-zinc-800 hover:text-white active:scale-95"
                  aria-label="Tải video về máy"
                >
                  <Download size={15} />
                  Tải xuống
                </a>

                {/* Copy URL */}
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-all hover:border-zinc-700 hover:bg-zinc-800 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Sao chép URL video"
                >
                  {copied ? (
                    <>
                      <CheckCheck size={15} className="text-emerald-400" />
                      <span className="text-emerald-400">Đã sao chép</span>
                    </>
                  ) : (
                    <>
                      <Copy size={15} />
                      Sao chép URL
                    </>
                  )}
                </button>

                {/* Regenerate */}
                <button
                  type="button"
                  onClick={() => regenerateMutation.mutate()}
                  disabled={regenerateMutation.isPending}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-all hover:border-zinc-700 hover:bg-zinc-800 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Tạo lại video"
                >
                  {regenerateMutation.isPending ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <RefreshCw size={15} />
                  )}
                  {regenerateMutation.isPending ? (
                    "Đang xử lý…"
                  ) : (
                    "Tạo lại"
                  )}
                </button>
              </div>

              {/* Regenerate error */}
              {regenerateMutation.isError && (
                <p className="flex items-center gap-2 text-xs text-red-400">
                  <AlertCircle size={13} />
                  {(regenerateMutation.error as Error)?.message ??
                    "Không thể gửi yêu cầu tạo lại."}
                </p>
              )}
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
