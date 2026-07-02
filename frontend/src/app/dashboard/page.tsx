'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import Link from 'next/link';
import {
  Lightbulb,
  PlayCircle,
  Video,
  Plus,
  ArrowRight,
  TrendingUp,
  Cpu,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
} from 'lucide-react';

const ACTIVE_STATUSES = [
  'queued',
  'running',
  'generating_script',
  'fetching_materials',
  'generating_voice',
  'generating_subtitle',
  'rendering',
  'uploading',
];

const STATUS_LABELS: Record<string, string> = {
  queued: 'Chờ xử lý',
  running: 'Đang chuẩn bị',
  generating_script: 'Viết kịch bản',
  fetching_materials: 'Tải tư liệu',
  generating_voice: 'Tạo giọng đọc',
  generating_subtitle: 'Tạo phụ đề',
  rendering: 'Render video',
  uploading: 'Đang tải lên',
  completed: 'Thành công',
  failed: 'Thất bại',
  cancelled: 'Đã hủy',
};

export default function Dashboard() {
  const { data: ideas = [], isLoading: isLoadingIdeas } = useQuery<any[]>({
    queryKey: ['ideas'],
    queryFn: () => api.get('/ideas').then((res) => res.data),
  });

  const { data: jobs = [], isLoading: isLoadingJobs } = useQuery<any[]>({
    queryKey: ['jobs'],
    queryFn: () => api.get('/jobs').then((res) => res.data),
    // Poll every 3s if any job is still active
    refetchInterval: (query) => {
      const list = query.state.data as any[];
      if (!list) return false;
      return list.some((j) => ACTIVE_STATUSES.includes(j.status)) ? 3000 : false;
    },
  });

  const { data: videos = [], isLoading: isLoadingVideos } = useQuery<any[]>({
    queryKey: ['videos'],
    queryFn: () => api.get('/videos').then((res) => res.data),
  });

  const activeJobs = jobs.filter((j) => ACTIVE_STATUSES.includes(j.status));
  const failedJobs = jobs.filter((j) => j.status === 'failed');
  const completedJobs = jobs.filter((j) => j.status === 'completed');

  const ideasWithScript = ideas.filter((i) => i.status === 'ready' || i.script);
  const generatingIdeas = ideas.filter((i) => i.status === 'generating');

  const statCards = [
    {
      name: 'Tổng số ý tưởng',
      value: isLoadingIdeas ? null : ideas.length,
      sub: isLoadingIdeas ? null : `${ideasWithScript.length} đã có kịch bản`,
      icon: Lightbulb,
      iconBg: 'bg-violet-500/10',
      iconColor: 'text-violet-400',
      href: '/ideas',
    },
    {
      name: 'Job đang chạy',
      value: isLoadingJobs ? null : activeJobs.length,
      sub: isLoadingJobs ? null : `${completedJobs.length} thành công · ${failedJobs.length} thất bại`,
      icon: PlayCircle,
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-400',
      href: '/jobs',
    },
    {
      name: 'Video đã tạo',
      value: isLoadingVideos ? null : videos.length,
      sub: isLoadingVideos ? null : `${completedJobs.length} job hoàn thành`,
      icon: Video,
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-400',
      href: '/videos',
    },
    {
      name: 'Đang sinh kịch bản',
      value: isLoadingIdeas ? null : generatingIdeas.length,
      sub: isLoadingIdeas ? null : generatingIdeas.length > 0 ? 'AI đang xử lý' : 'Không có gì đang chạy',
      icon: FileText,
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-400',
      href: '/ideas',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 p-8 rounded-xl border border-zinc-900 bg-zinc-950 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-violet-600/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
        <div className="relative z-10">
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Chào mừng bạn đến với Turbo Video 🚀
          </h2>
          <p className="mt-1.5 text-zinc-400 text-sm max-w-xl">
            Nền tảng tự động hóa sản xuất video ngắn TikTok, Shorts và Reels từ ý tưởng bằng AI.
          </p>
        </div>
        <Link
          href="/ideas"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-semibold text-sm shadow-sm transition-all self-start md:self-auto relative z-10 flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          Tạo ý tưởng mới
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Link
            key={stat.name}
            href={stat.href}
            className="p-5 rounded-lg border border-zinc-900 bg-zinc-950 hover:border-zinc-800 hover:bg-zinc-900/30 transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{stat.name}</p>
              <div className={`p-2 rounded-md ${stat.iconBg}`}>
                <stat.icon className={`w-4 h-4 ${stat.iconColor}`} />
              </div>
            </div>
            <div>
              {stat.value === null ? (
                <div className="w-12 h-8 bg-zinc-900 rounded animate-pulse" />
              ) : (
                <p className="text-3xl font-bold text-white tabular-nums tracking-tight">
                  {stat.value}
                </p>
              )}
              <p className="text-xs text-zinc-500 mt-1">
                {stat.sub === null ? (
                  <span className="inline-block w-24 h-3 bg-zinc-900 rounded animate-pulse" />
                ) : (
                  stat.sub
                )}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Active Jobs & Recent Videos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Jobs */}
        <div className="rounded-lg border border-zinc-900 bg-zinc-950 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-900">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-400" />
              Job đang chạy
              {activeJobs.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold">
                  {activeJobs.length}
                </span>
              )}
            </h3>
            <Link
              href="/jobs"
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
            >
              Xem tất cả <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-4 space-y-3">
            {isLoadingJobs ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 text-zinc-700 animate-spin" />
              </div>
            ) : activeJobs.length === 0 ? (
              <div className="text-center py-10 text-zinc-600 text-sm border border-dashed border-zinc-900 rounded-md">
                Không có job nào đang chạy.
              </div>
            ) : (
              activeJobs.map((job) => (
                <div key={job.id} className="p-4 rounded-md bg-zinc-900/30 border border-zinc-900 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-semibold text-zinc-200 truncate">
                      {job.idea?.title || 'Không có tiêu đề'}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-900/50 uppercase tracking-wider whitespace-nowrap flex-shrink-0">
                      {STATUS_LABELS[job.status] || job.status}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] text-zinc-500">
                      <span>Tiến độ</span>
                      <span className="tabular-nums font-bold">{job.progress ?? 0}%</span>
                    </div>
                    <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden border border-zinc-850">
                      <div
                        className="bg-blue-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${job.progress ?? 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Jobs Summary */}
        <div className="rounded-lg border border-zinc-900 bg-zinc-950 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-900">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Lịch sử gần đây
            </h3>
            <Link
              href="/jobs"
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
            >
              Xem tất cả <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-zinc-900">
            {isLoadingJobs ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 text-zinc-700 animate-spin" />
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-10 text-zinc-600 text-sm border border-dashed border-zinc-900 rounded-md m-4">
                Chưa có job nào được tạo.
              </div>
            ) : (
              jobs.slice(0, 6).map((job) => {
                const isActive = ACTIVE_STATUSES.includes(job.status);
                const isCompleted = job.status === 'completed';
                const isFailed = job.status === 'failed';
                return (
                  <div key={job.id} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-900/30 transition-colors">
                    <div className="flex-shrink-0">
                      {isActive && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
                      {isCompleted && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      {isFailed && <AlertCircle className="w-4 h-4 text-rose-400" />}
                      {job.status === 'cancelled' && <Clock className="w-4 h-4 text-zinc-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-zinc-200 truncate">
                        {job.idea?.title || 'Không có tiêu đề'}
                      </p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        {STATUS_LABELS[job.status] || job.status}
                        {isActive && job.progress != null && ` · ${job.progress}%`}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-md border ${
                          isCompleted
                            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50'
                            : isFailed
                            ? 'bg-rose-950/40 text-rose-400 border-rose-900/50'
                            : isActive
                            ? 'bg-blue-950/40 text-blue-400 border-blue-900/50'
                            : 'bg-zinc-900 text-zinc-400 border-zinc-850'
                        }`}
                      >
                        {isActive ? `${job.progress ?? 0}%` : STATUS_LABELS[job.status] || job.status}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Recent Videos */}
      {videos.length > 0 && (
        <div className="rounded-lg border border-zinc-900 bg-zinc-950 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-900">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Video className="w-4 h-4 text-violet-400" />
              Video mới nhất
            </h3>
            <Link
              href="/videos"
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
            >
              Bộ sưu tập <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-zinc-900">
            {videos.slice(0, 3).map((video) => (
              <div key={video.id} className="bg-zinc-950 p-4 flex items-center gap-3 hover:bg-zinc-900/30 transition-colors">
                <div className="w-10 h-14 rounded-md bg-zinc-900 border border-zinc-850 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {video.thumbnailUrl ? (
                    <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
                  ) : (
                    <Video className="w-4 h-4 text-zinc-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-zinc-200 truncate">{video.title}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    {video.ratio} · {new Date(video.createdAt).toLocaleDateString('vi-VN')}
                  </p>
                </div>
                {video.videoUrl && (
                  <a
                    href={video.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-850 hover:border-zinc-750 text-zinc-300 hover:text-white transition-all flex-shrink-0"
                  >
                    Xem
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
