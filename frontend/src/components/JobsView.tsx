'use client';

import React, { Suspense, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import Link from 'next/link';
import {
  PlayCircle,
  XCircle,
  RefreshCw,
  Clock,
  Terminal,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
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

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  queued: { label: 'Chờ xử lý', color: 'text-zinc-400', bg: 'bg-zinc-800/60', border: 'border-zinc-700/40' },
  running: { label: 'Đang chuẩn bị', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-900/40' },
  generating_script: { label: 'Viết kịch bản', color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-900/40' },
  fetching_materials: { label: 'Tải tư liệu', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-900/40' },
  generating_voice: { label: 'Tạo giọng đọc', color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-900/40' },
  generating_subtitle: { label: 'Tạo phụ đề', color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-900/40' },
  rendering: { label: 'Render video', color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-900/40' },
  uploading: { label: 'Đang tải lên', color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-900/40' },
  completed: { label: 'Thành công', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-900/40' },
  failed: { label: 'Thất bại', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-900/40' },
  cancelled: { label: 'Đã hủy', color: 'text-zinc-500', bg: 'bg-zinc-900/40', border: 'border-zinc-800/40' },
};

const PIPELINE_STEPS = [
  { key: 'queued', label: 'Chờ' },
  { key: 'generating_script', label: 'Kịch bản' },
  { key: 'fetching_materials', label: 'Tư liệu' },
  { key: 'generating_voice', label: 'Giọng đọc' },
  { key: 'generating_subtitle', label: 'Phụ đề' },
  { key: 'rendering', label: 'Render' },
  { key: 'uploading', label: 'Upload' },
  { key: 'completed', label: 'Xong' },
];

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? {
    label: status,
    color: 'text-zinc-400',
    bg: 'bg-zinc-800',
    border: 'border-zinc-700',
  };
  const isActive = ACTIVE_STATUSES.includes(status) && status !== 'queued';

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md border ${meta.bg} ${meta.color} ${meta.border} uppercase tracking-wider whitespace-nowrap`}
    >
      {isActive && <Loader2 className="w-3 h-3 animate-spin" />}
      {status === 'queued' && <Clock className="w-3 h-3" />}
      {status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
      {status === 'failed' && <AlertCircle className="w-3 h-3" />}
      {status === 'cancelled' && <XCircle className="w-3 h-3" />}
      {meta.label}
    </span>
  );
}

function PipelineStepper({ status }: { status: string }) {
  const currentIdx = PIPELINE_STEPS.findIndex((s) => s.key === status);
  const isFailed = status === 'failed';
  const isCancelled = status === 'cancelled';

  return (
    <div className="flex items-center gap-0 w-full overflow-x-auto py-1 scrollbar-none">
      {PIPELINE_STEPS.map((step, idx) => {
        const isDone = !isFailed && !isCancelled && (currentIdx > idx || status === 'completed');
        const isActive = currentIdx === idx && !isFailed && !isCancelled;

        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${
                  isDone
                    ? 'bg-emerald-500/20 border-emerald-500/60'
                    : isActive
                      ? 'bg-blue-500/20 border-blue-500/70 ring-2 ring-blue-500/20'
                      : 'bg-zinc-900 border-zinc-800'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                ) : isActive ? (
                  <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
                )}
              </div>
              <span
                className={`text-[9px] font-semibold whitespace-nowrap ${
                  isDone ? 'text-emerald-500' : isActive ? 'text-blue-400' : 'text-zinc-700'
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < PIPELINE_STEPS.length - 1 && (
              <div
                className={`h-px flex-1 min-w-[12px] mx-0.5 mb-3.5 transition-all ${
                  isDone ? 'bg-emerald-700/60' : 'bg-zinc-800'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function JobsInner({ selectedJobId }: { selectedJobId?: string | null }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const navigateToJob = (id: string | null) => {
    router.push(id ? `/jobs/${id}` : '/jobs', { scroll: false });
  };

  const { data: jobs = [], isLoading } = useQuery<any[]>({
    queryKey: ['jobs'],
    queryFn: () => api.get('/jobs').then((res) => res.data),
    refetchInterval: (query) => {
      const list = query.state.data as any[];
      if (!list) return 3000;
      return list.some((j) => ACTIVE_STATUSES.includes(j.status)) ? 3000 : false;
    },
  });

  const { data: selectedJob } = useQuery<any>({
    queryKey: ['job', selectedJobId],
    queryFn: () => api.get(`/jobs/${selectedJobId}`).then((res) => res.data),
    enabled: !!selectedJobId,
    refetchInterval: (query) => {
      const job = query.state.data as any;
      if (!job) return 3000;
      return ACTIVE_STATUSES.includes(job.status) ? 2000 : false;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.post(`/jobs/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', selectedJobId] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => api.post(`/jobs/${id}/retry`).then((res) => res.data),
    onSuccess: (newJob) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      navigateToJob(newJob.id);
    },
  });

  useEffect(() => {
    if (!selectedJobId && jobs.length > 0) {
      const active = jobs.find((j) => ACTIVE_STATUSES.includes(j.status));
      navigateToJob(active?.id ?? jobs[0].id);
    }
  }, [jobs, selectedJobId]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedJob?.logs]);

  const isJobActive = (status: string) => ACTIVE_STATUSES.includes(status);

  return (
    <div className="flex gap-5 h-[calc(100vh-7rem)]">
      <div className="w-80 flex flex-col min-w-0 rounded-lg border border-zinc-900 bg-zinc-950 overflow-hidden flex-shrink-0">
        <div className="px-4 py-3.5 border-b border-zinc-900 flex items-center gap-2">
          <PlayCircle className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-bold text-white">Hàng đợi</h2>
          {jobs.some((j) => isJobActive(j.status)) && (
            <span className="ml-auto w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          )}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-zinc-900/60">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-16 text-zinc-600 text-xs px-4">
              Chưa có job nào được tạo.
            </div>
          ) : (
            jobs.map((job) => {
              const isSelected = selectedJobId === job.id;
              const active = isJobActive(job.status);
              const meta = STATUS_META[job.status] ?? STATUS_META.cancelled;

              return (
                <button
                  key={job.id}
                  onClick={() => navigateToJob(job.id)}
                  className={`w-full text-left px-4 py-3 transition-colors flex items-start gap-3 ${
                    isSelected ? 'bg-zinc-900/60' : 'hover:bg-zinc-900/30'
                  }`}
                >
                  <div
                    className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                      active
                        ? 'bg-blue-400 animate-pulse'
                        : job.status === 'completed'
                          ? 'bg-emerald-400'
                          : job.status === 'failed'
                            ? 'bg-rose-400'
                            : 'bg-zinc-700'
                    }`}
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-xs font-semibold text-zinc-200 truncate leading-snug">
                      {job.idea?.title || 'Không có tiêu đề'}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold ${meta.color}`}>{meta.label}</span>
                      {active && job.progress != null && (
                        <span className="text-[10px] text-zinc-600 tabular-nums">{job.progress}%</span>
                      )}
                    </div>
                    {active && (
                      <div className="w-full bg-zinc-900 h-1 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${job.progress ?? 0}%` }}
                        />
                      </div>
                    )}
                  </div>
                  {isSelected && <ChevronRight className="w-3.5 h-3.5 text-zinc-600 mt-0.5 flex-shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="flex-1 rounded-lg border border-zinc-900 bg-zinc-950 flex flex-col min-w-0 overflow-hidden">
        {selectedJob ? (
          <>
            <div className="px-5 py-3.5 border-b border-zinc-900 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                {selectedJob.idea?.id ? (
                  <Link
                    href={`/ideas/${selectedJob.idea.id}`}
                    className="group inline-flex items-center gap-1.5 hover:text-white transition-colors"
                  >
                    <h3 className="text-sm font-bold text-zinc-200 group-hover:text-white truncate">
                      {selectedJob.idea?.title}
                    </h3>
                    <ExternalLink className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 flex-shrink-0" />
                  </Link>
                ) : (
                  <h3 className="text-sm font-bold text-white truncate">{selectedJob.idea?.title}</h3>
                )}
                <p className="text-[10px] text-zinc-600 font-mono mt-0.5">
                  Job ID: {selectedJob.id} · {new Date(selectedJob.createdAt).toLocaleString('vi-VN')}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <StatusBadge status={selectedJob.status} />
                {(selectedJob.status === 'failed' || selectedJob.status === 'cancelled') && (
                  <button
                    disabled={retryMutation.isPending}
                    onClick={() => retryMutation.mutate(selectedJob.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold transition-all disabled:opacity-50"
                    title="Thử lại"
                  >
                    {retryMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Thử lại
                  </button>
                )}
                {isJobActive(selectedJob.status) && (
                  <button
                    disabled={cancelMutation.isPending}
                    onClick={() => cancelMutation.mutate(selectedJob.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-rose-950/30 border border-rose-900/40 hover:border-rose-800 text-rose-400 hover:text-rose-300 text-xs font-semibold transition-all disabled:opacity-50"
                    title="Hủy"
                  >
                    {cancelMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                    Hủy
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-5 gap-4">
              <div className="rounded-md border border-zinc-900 bg-zinc-900/30 px-4 py-3">
                <PipelineStepper status={selectedJob.status} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border border-zinc-900 bg-zinc-900/30 px-4 py-3 space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-zinc-500 font-semibold">Tiến độ tổng</span>
                    <span className="font-bold text-zinc-200 tabular-nums">{selectedJob.progress ?? 0}%</span>
                  </div>
                  <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden border border-zinc-850">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        selectedJob.status === 'completed'
                          ? 'bg-emerald-500'
                          : selectedJob.status === 'failed'
                            ? 'bg-rose-500'
                            : 'bg-blue-500'
                      }`}
                      style={{ width: `${selectedJob.progress ?? 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-600">
                    <span>Bắt đầu: {new Date(selectedJob.createdAt).toLocaleString('vi-VN')}</span>
                    {selectedJob.finishedAt && (
                      <span>Kết thúc: {new Date(selectedJob.finishedAt).toLocaleString('vi-VN')}</span>
                    )}
                  </div>
                </div>

                <div className="rounded-md border border-zinc-900 bg-zinc-900/30 px-4 py-3 space-y-1.5">
                  <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider mb-2">Cấu hình</p>
                  {[
                    { label: 'Tỷ lệ', value: selectedJob.config?.aspect_ratio ?? '9:16' },
                    { label: 'Nguồn', value: selectedJob.config?.video_source ?? 'pexels' },
                    { label: 'Giọng', value: selectedJob.config?.voice_name ?? '—' },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between text-[11px]">
                      <span className="text-zinc-600">{item.label}</span>
                      <span className="text-zinc-300 font-semibold truncate max-w-[140px]">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedJob.errorMessage && (
                <div className="flex gap-2.5 p-3 rounded-md bg-rose-950/20 border border-rose-900/30 text-rose-400 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold mb-0.5">Lỗi xảy ra:</p>
                    <p className="text-rose-400/80 leading-relaxed font-mono">{selectedJob.errorMessage}</p>
                  </div>
                </div>
              )}

              <div className="flex-1 flex flex-col min-h-0 rounded-md border border-zinc-900 overflow-hidden bg-zinc-950">
                <div className="px-4 py-2 border-b border-zinc-900 flex items-center gap-2 bg-zinc-950/80 flex-shrink-0">
                  <Terminal className="w-3.5 h-3.5 text-zinc-600" />
                  <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider font-mono">Console Output</span>
                  <span className="text-[10px] text-zinc-700 ml-1">({selectedJob.logs?.length ?? 0} dòng)</span>
                  {isJobActive(selectedJob.status) && (
                    <span className="ml-auto flex items-center gap-1.5 text-[10px] text-blue-400 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                      Live
                    </span>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] text-zinc-400 space-y-0.5 leading-relaxed">
                  {!selectedJob.logs?.length ? (
                    <p className="text-zinc-700 italic">Chưa có log nào từ engine…</p>
                  ) : (
                    selectedJob.logs.map((log: any) => (
                      <div
                        key={log.id}
                        className={
                          log.level === 'warn'
                            ? 'text-amber-400/90'
                            : log.level === 'error'
                              ? 'text-rose-400/90'
                              : log.level === 'success'
                                ? 'text-emerald-400/90'
                                : 'text-zinc-400'
                        }
                      >
                        <span className="text-zinc-700 select-none mr-2">
                          [{new Date(log.createdAt).toLocaleTimeString('vi-VN')}]
                        </span>
                        {log.message}
                      </div>
                    ))
                  )}
                  <div ref={terminalEndRef} />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col justify-center items-center text-center p-8 text-zinc-600 space-y-3">
            <Terminal className="w-10 h-10 text-zinc-800" />
            <p className="text-sm">Chọn một job ở bên trái để xem tiến trình chi tiết và console logs.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function JobsView({ selectedJobId }: { selectedJobId?: string | null }) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[calc(100vh-7rem)] text-zinc-600">
          <div className="w-6 h-6 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
        </div>
      }
    >
      <JobsInner selectedJobId={selectedJobId} />
    </Suspense>
  );
}
