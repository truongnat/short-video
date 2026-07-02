'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useToast } from '@/components/Toast';
import {
  Lightbulb,
  Plus,
  Trash2,
  Sparkles,
  Play,
  Loader2,
  FileText,
  X,
  Sliders,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

export default function Ideas() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [isMounted, setIsMounted] = useState(false);
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [ideaToDelete, setIdeaToDelete] = useState<any | null>(null);

  // Form states for creating new idea
  const [newTitle, setNewTitle] = useState('');
  const [newTopic, setNewTopic] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newLang, setNewLang] = useState('vi');
  const [newTags, setNewTags] = useState('');
  const [activeTab, setActiveTab] = useState<'ai' | 'manual'>('ai');
  const [autoGenScript, setAutoGenScript] = useState(true);

  // Video generation config state
  const [configVoice, setConfigVoice] = useState('vi-VN-HoaiMyNeural');
  const [configRatio, setConfigRatio] = useState('9:16');
  const [configSource, setConfigSource] = useState('pexels');
  const [configBgm, setConfigBgm] = useState('random');

  // Fetch all ideas with polling when active job is running
  const { data: ideas = [], isLoading } = useQuery<any[]>({
    queryKey: ['ideas'],
    queryFn: () => api.get('/ideas').then((res) => res.data),
    refetchInterval: (query) => {
      const ideasList = query.state.data as any[];
      if (!ideasList) return false;

      const hasActiveJob = ideasList.some((idea: any) => {
        if (idea.status === 'generating') return true;
        const latestJob = idea.jobs?.[0];
        return (
          latestJob &&
          [
            'queued',
            'running',
            'generating_script',
            'fetching_materials',
            'generating_voice',
            'generating_subtitle',
            'rendering',
            'uploading',
          ].includes(latestJob.status)
        );
      });

      return hasActiveJob ? 3000 : false;
    },
  });

  const { data: settings = {} } = useQuery<any>({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then((res) => res.data),
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (settings) {
      if (settings.default_voice) setConfigVoice(settings.default_voice);
      if (settings.default_aspect_ratio) setConfigRatio(settings.default_aspect_ratio);
      if (settings.default_video_source) setConfigSource(settings.default_video_source);
    }
  }, [settings]);

  // Selected idea helper (keeps selection synced with fresh backend query data)
  const selectedIdea = ideas.find((i) => i.id === selectedIdeaId) || null;

  useEffect(() => {
    if (!selectedIdea) return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [selectedIdea]);

  // Create idea mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/ideas', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ideas'] });
      setShowCreateModal(false);
      resetCreateForm();
      toast.success('Đã tạo ý tưởng thành công!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Tạo ý tưởng thất bại');
    },
  });

  // Delete idea mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/ideas/${id}`),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['ideas'] });
      toast.success('Đã xóa ý tưởng thành công!');
      if (selectedIdeaId === deletedId) {
        setSelectedIdeaId(null);
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Xóa ý tưởng thất bại');
    },
  });

  // Brainstorm ideas mutation (adds ideas relative to an existing idea)
  const brainstormMutation = useMutation({
    mutationFn: (id: string) => api.post(`/ideas/${id}/generate-more`).then((res) => res.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ideas'] });
      toast.success(`Đã gợi ý thêm ${data.length} ý tưởng mới từ AI!`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Không thể gợi ý thêm ý tưởng');
    },
  });

  // Brainstorm ideas directly from a new Topic
  const brainstormTopicMutation = useMutation({
    mutationFn: (payload: { topic: string; language: string }) =>
      api.post('/ideas/brainstorm', payload).then((res) => res.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ideas'] });
      toast.success(`AI đã gợi ý và đang viết kịch bản cho ${data.length} ý tưởng mới ở nền!`);
      setShowCreateModal(false);
      resetCreateForm();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Gợi ý ý tưởng thất bại');
    },
  });

  // Generate script mutation
  const scriptMutation = useMutation({
    mutationFn: (id: string) => api.post(`/ideas/${id}/generate-script`).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ideas'] });
      toast.success('Đã tạo kịch bản chi tiết thành công!');
    },
    onError: (err: any) => {
      queryClient.invalidateQueries({ queryKey: ['ideas'] });
      toast.error(err.response?.data?.message || 'Tạo kịch bản thất bại');
    },
  });

  // Generate video job mutation
  const videoJobMutation = useMutation({
    mutationFn: ({ id, config }: { id: string; config: any }) =>
      api.post(`/ideas/${id}/generate-video`, config),
    onSuccess: () => {
      setShowConfigModal(false);
      queryClient.invalidateQueries({ queryKey: ['ideas'] });
      toast.success('Đã thêm job sinh video vào hàng đợi thành công!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Khởi tạo job thất bại');
    },
  });

  const resetCreateForm = () => {
    setNewTitle('');
    setNewTopic('');
    setNewDesc('');
    setNewLang('vi');
    setNewTags('');
    setAutoGenScript(true);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'ai') {
      if (!newTopic) return;
      brainstormTopicMutation.mutate({
        topic: newTopic,
        language: newLang,
      });
    } else {
      if (!newTitle || !newTopic) return;
      createMutation.mutate({
        title: newTitle,
        topic: newTopic,
        description: newDesc,
        language: newLang,
        tags: newTags ? newTags.split(',').map((t) => t.trim()) : [],
        autoGenerateScript: autoGenScript,
      });
    }
  };

  const handleGenerateScript = (id: string) => {
    scriptMutation.mutate(id);
  };

  const handleBrainstorm = (id: string) => {
    brainstormMutation.mutate(id);
  };

  const handleStartGenerateVideo = () => {
    if (!selectedIdea) return;
    videoJobMutation.mutate({
      id: selectedIdea.id,
      config: {
        voice_name: configVoice,
        aspect_ratio: configRatio,
        video_source: configSource,
        bgm_type: configBgm,
      },
    });
  };

  const getJobStatusLabel = (status: string) => {
    switch (status) {
      case 'queued':
        return 'Chờ xử lý';
      case 'running':
        return 'Đang chuẩn bị';
      case 'generating_script':
        return 'Đang viết kịch bản';
      case 'fetching_materials':
        return 'Đang tải tư liệu';
      case 'generating_voice':
        return 'Đang tạo giọng đọc';
      case 'generating_subtitle':
        return 'Đang tạo phụ đề';
      case 'rendering':
        return 'Đang render video';
      case 'uploading':
        return 'Đang tải lên';
      case 'completed':
        return 'Thành công';
      case 'failed':
        return 'Thất bại';
      case 'cancelled':
        return 'Đã hủy';
      default:
        return status;
    }
  };

  const isJobActive = (jobStatus: string) => {
    return [
      'queued',
      'running',
      'generating_script',
      'fetching_materials',
      'generating_voice',
      'generating_subtitle',
      'rendering',
      'uploading',
    ].includes(jobStatus);
  };

  const isIdeaLocked = (idea: any) => {
    if (!idea) return false;
    if (idea.status === 'generating') return true;
    const latestJob = idea.jobs?.[0];
    return latestJob && isJobActive(latestJob.status);
  };

  const renderJobStatus = (idea: any) => {
    if (idea.status === 'generating') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded-md bg-violet-950/40 text-violet-400 border border-violet-850">
          <Loader2 className="w-3 h-3 animate-spin" />
          Tạo kịch bản
        </span>
      );
    }

    const latestJob = idea.jobs?.[0];
    if (!latestJob) {
      return <span className="text-zinc-500 text-xs font-medium">Chưa tạo video</span>;
    }

    const status = latestJob.status;
    const progress = latestJob.progress;

    switch (status) {
      case 'queued':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded-md bg-amber-950/40 text-amber-400 border border-amber-900/50">
            <Clock className="w-3 h-3 animate-pulse" />
            Chờ xử lý
          </span>
        );
      case 'running':
      case 'generating_script':
      case 'fetching_materials':
      case 'generating_voice':
      case 'generating_subtitle':
      case 'rendering':
      case 'uploading':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded-md bg-blue-950/40 text-blue-400 border border-blue-900/50">
            <Loader2 className="w-3 h-3 animate-spin" />
            {getJobStatusLabel(status)} ({progress}%)
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded-md bg-emerald-950/40 text-emerald-400 border border-emerald-900/50">
            <CheckCircle2 className="w-3 h-3" />
            Thành công
          </span>
        );
      case 'failed':
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded-md bg-rose-950/40 text-rose-400 border border-rose-900/50 cursor-help"
            title={latestJob.errorMessage || 'Lỗi không xác định'}
          >
            <AlertCircle className="w-3 h-3" />
            Thất bại
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded-md bg-zinc-900 text-zinc-400 border border-zinc-800">
            Đã hủy
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-md bg-zinc-900 text-zinc-400 border border-zinc-850">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-900 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-violet-500" />
            Quản lý Ý tưởng
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Danh sách các ý tưởng, kịch bản chi tiết và quá trình sinh video ngắn.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-semibold text-xs shadow-sm transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            Ý tưởng mới
          </button>
        </div>
      </div>

      <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-[0_0_0_1px_rgba(63,63,70,0.22)]">
        {isLoading ? (
          <div className="flex justify-center items-center py-24">
            <Loader2 className="w-8 h-8 text-zinc-750 animate-spin" />
          </div>
        ) : ideas.length === 0 ? (
          <div className="text-center py-20 text-zinc-500 text-sm">
            Chưa có ý tưởng nào. Hãy tạo một ý tưởng mới để bắt đầu.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/70 text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  <th className="p-4 w-[38%]">Ý tưởng / Chủ đề</th>
                  <th className="p-4 w-[14%]">Ngôn ngữ</th>
                  <th className="p-4 w-[18%]">Kịch bản</th>
                  <th className="p-4 w-[18%]">Trạng thái Job</th>
                  <th className="p-4 w-[12%] text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/90">
                {ideas.map((idea) => {
                  const isSelected = selectedIdeaId === idea.id;
                  const isLocked = isIdeaLocked(idea);
                  return (
                    <tr
                      key={idea.id}
                      onClick={() => setSelectedIdeaId(idea.id)}
                      className={`hover:bg-zinc-900/55 cursor-pointer transition-all ${
                        isSelected ? 'bg-zinc-900/90 shadow-[inset_3px_0_0_0_#8b5cf6]' : ''
                      }`}
                    >
                      <td className="p-4">
                        <div className="font-semibold text-zinc-200 truncate max-w-[320px]">
                          {idea.title}
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5 truncate max-w-[320px]">
                          {idea.topic}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-zinc-900 text-zinc-300 border border-zinc-800">
                          {idea.language === 'vi' ? 'Tiếng Việt' : 'Tiếng Anh'}
                        </span>
                      </td>
                      <td className="p-4">
                        {idea.status === 'ready' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Sẵn sàng
                          </span>
                        ) : idea.status === 'generating' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-violet-400 font-medium animate-pulse">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Đang viết...
                          </span>
                        ) : (
                          <span className="text-zinc-500 text-xs font-medium">Chưa viết</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="rounded-md border border-zinc-800 bg-zinc-950/70 px-2.5 py-2">
                          {renderJobStatus(idea)}
                        </div>
                      </td>
                      <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => setSelectedIdeaId(idea.id)}
                            className="p-1.5 rounded-md hover:bg-zinc-900 text-zinc-500 hover:text-zinc-200 transition-colors"
                            title="Mở drawer"
                            aria-label="Mở drawer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <Link
                            href={`/ideas/${idea.id}`}
                            className="p-1.5 rounded-md hover:bg-zinc-900 text-zinc-500 hover:text-zinc-200 transition-colors"
                            title="Trang chi tiết"
                            aria-label="Trang chi tiết"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                          <button
                            disabled={isLocked || brainstormMutation.isPending}
                            onClick={() => handleBrainstorm(idea.id)}
                            className="p-1.5 rounded-md hover:bg-zinc-900 text-zinc-500 hover:text-violet-400 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                            title="Gợi ý thêm các ý tưởng tương tự bằng AI"
                            aria-label="Gợi ý thêm"
                          >
                            {brainstormMutation.isPending && brainstormMutation.variables === idea.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Sparkles className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            disabled={isLocked}
                            onClick={() => setIdeaToDelete(idea)}
                            className="p-1.5 rounded-md hover:bg-zinc-900 text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                            title="Xóa ý tưởng"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isMounted && selectedIdea && createPortal(
        <>
          <button
            type="button"
            aria-label="Đóng drawer"
            onClick={() => setSelectedIdeaId(null)}
            className="fixed inset-0 z-40 bg-black/65 backdrop-blur-[2px] transition-opacity duration-300 ease-out"
          />
          <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl translate-x-0 border-l border-zinc-800 bg-zinc-950/98 shadow-[0_0_0_1px_rgba(63,63,70,0.35),-24px_0_80px_rgba(0,0,0,0.55)] transition-transform duration-300 ease-out">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-6 py-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-600">
                    Idea Inspector
                  </p>
                  <h2 className="mt-1 text-sm font-semibold text-zinc-200">
                    Xem nhanh và thao tác
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedIdeaId(null)}
                  className="rounded-md border border-zinc-700 bg-zinc-900/80 p-2 text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-200"
                  aria-label="Đóng"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex-1 flex flex-col h-full space-y-6">
              {/* Info Header */}
              <div>
                <div className="flex justify-between items-start gap-4">
                  <h3 className="font-bold text-lg text-white leading-tight">
                    {selectedIdea.title}
                  </h3>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/ideas/${selectedIdea.id}`}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                      ID
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                    <span className="text-xs font-semibold text-zinc-400 uppercase bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">
                      {selectedIdea.language}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-violet-400 mt-2 font-medium">
                  Chủ đề: {selectedIdea.topic}
                </p>
                {selectedIdea.description && (
                  <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs leading-relaxed text-zinc-300 shadow-[inset_0_0_0_1px_rgba(39,39,42,0.45)]">
                    <strong>Yêu cầu kịch bản:</strong> {selectedIdea.description}
                  </div>
                )}
              </div>

              {/* Job Progress Tracking (if active) */}
              {(() => {
                const latestJob = selectedIdea.jobs?.[0];
                const isActive = latestJob && isJobActive(latestJob.status);
                const isScriptGenerating = selectedIdea.status === 'generating';

                if (isScriptGenerating) {
                  return (
                    <div className="p-4 rounded-md border border-violet-900/30 bg-violet-950/10 space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-violet-400 font-semibold flex items-center gap-1.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Đang tạo kịch bản chi tiết...
                        </span>
                      </div>
                      <div className="w-full bg-zinc-900 h-1 rounded-full overflow-hidden">
                        <div className="bg-violet-500 h-full w-full animate-pulse" />
                      </div>
                    </div>
                  );
                }

                if (isActive) {
                  return (
                    <div className="p-4 rounded-md border border-blue-900/30 bg-blue-950/10 space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-blue-400 font-semibold flex items-center gap-1.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          {getJobStatusLabel(latestJob.status)}...
                        </span>
                        <span className="text-zinc-400 font-medium">{latestJob.progress}%</span>
                      </div>
                      <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-500 h-full transition-all duration-500"
                          style={{ width: `${latestJob.progress}%` }}
                        />
                      </div>
                    </div>
                  );
                }

                return null;
              })()}

              {/* Script Details view */}
              <div className="flex-1 flex flex-col min-h-[220px] space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-zinc-400 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" />
                    Nội dung kịch bản
                  </label>
                  {selectedIdea.script && (
                    <button
                      disabled={scriptMutation.isPending || isIdeaLocked(selectedIdea)}
                      onClick={() => handleGenerateScript(selectedIdea.id)}
                      className="text-[11px] font-bold text-violet-400 hover:text-violet-300 flex items-center gap-1 disabled:opacity-50 transition-colors"
                    >
                      {scriptMutation.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      AI viết lại
                    </button>
                  )}
                </div>

                {selectedIdea.script ? (
                  <div className="flex-1 max-h-[300px] overflow-y-auto whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-900/55 p-4 font-mono text-xs leading-relaxed text-zinc-300 shadow-[inset_0_0_0_1px_rgba(39,39,42,0.45)]">
                    {selectedIdea.script}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center space-y-4 rounded-lg border border-dashed border-zinc-700 bg-zinc-950/70 p-6 text-center">
                    <div className="p-3 rounded-full bg-violet-500/5 border border-violet-500/10">
                      <Sparkles className="w-5 h-5 text-violet-400" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-zinc-300">Chưa có kịch bản</h4>
                      <p className="text-[11px] text-zinc-500 max-w-[220px] mx-auto leading-normal">
                        Hãy để AI viết kịch bản chi tiết dựa trên thông tin ý tưởng này.
                      </p>
                    </div>
                    <button
                      disabled={scriptMutation.isPending || isIdeaLocked(selectedIdea)}
                      onClick={() => handleGenerateScript(selectedIdea.id)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold text-xs shadow-sm transition-all disabled:opacity-50"
                    >
                      {scriptMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      AI Tự Động Viết Kịch Bản
                    </button>
                  </div>
                )}
              </div>

              {/* Render Trigger Button */}
              <button
                onClick={() => setShowConfigModal(true)}
                disabled={!selectedIdea.script || isIdeaLocked(selectedIdea)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md bg-violet-600 hover:bg-violet-750 text-white font-semibold text-xs shadow-sm transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                Tiến hành Tạo Video
              </button>
            </div>
              </div>
            </div>
          </aside>
        </>,
        document.body,
      )}

      {/* Modal: Create Idea */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-[0_0_0_1px_rgba(63,63,70,0.32),0_24px_80px_rgba(0,0,0,0.55)]">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-md hover:bg-zinc-900 text-zinc-500 hover:text-white"
              aria-label="Đóng"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="font-bold text-lg text-white mb-5 flex items-center gap-2">
              <Plus className="w-5 h-5 text-violet-500" />
              Thêm Ý Tưởng Mới
            </h3>

            {/* Tabs selector */}
            <div className="flex border-b border-zinc-900 mb-5">
              <button
                type="button"
                onClick={() => setActiveTab('ai')}
                className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-all ${
                  activeTab === 'ai'
                    ? 'border-violet-500 text-violet-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                AI Tự Động Gợi Ý (5 Ý Tưởng)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('manual')}
                className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-all ${
                  activeTab === 'manual'
                    ? 'border-violet-500 text-violet-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Tạo Thủ Công
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {activeTab === 'ai' ? (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-400">Chủ đề gốc để AI gợi ý *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Lịch sử nhà Trần, kiến thức vũ trụ thú vị..."
                      value={newTopic}
                      onChange={(e) => setNewTopic(e.target.value)}
                      className="w-full px-3 py-2 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm placeholder-zinc-650 focus:outline-none focus:border-zinc-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-400">Ngôn ngữ kịch bản</label>
                    <select
                      value={newLang}
                      onChange={(e) => setNewLang(e.target.value)}
                      className="w-full px-3 py-2 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-zinc-500"
                    >
                      <option value="vi">Tiếng Việt (vi)</option>
                      <option value="en">Tiếng Anh (en)</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={brainstormTopicMutation.isPending}
                    className="w-full py-2.5 mt-4 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {brainstormTopicMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    AI Gợi Ý & Tự Động Viết 5 Kịch Bản
                  </button>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-400">Tiêu đề ý tưởng *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Bí ẩn cấu trúc cây cầu Vàng Đà Nẵng"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm placeholder-zinc-650 focus:outline-none focus:border-zinc-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-400">Chủ đề gốc *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Du lịch Việt Nam"
                      value={newTopic}
                      onChange={(e) => setNewTopic(e.target.value)}
                      className="w-full px-3 py-2 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm placeholder-zinc-650 focus:outline-none focus:border-zinc-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-400">Mô tả ngắn / Yêu cầu viết</label>
                    <textarea
                      placeholder="Ví dụ: Kịch bản dài khoảng 3 câu, cuốn hút, nhấn mạnh sự độc đáo của..."
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm placeholder-zinc-650 focus:outline-none focus:border-zinc-500 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-400">Ngôn ngữ</label>
                      <select
                        value={newLang}
                        onChange={(e) => setNewLang(e.target.value)}
                        className="w-full px-3 py-2 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-zinc-500"
                      >
                        <option value="vi">Tiếng Việt (vi)</option>
                        <option value="en">Tiếng Anh (en)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-400">Tags (phân cách bởi dấu phẩy)</label>
                      <input
                        type="text"
                        placeholder="dulich, kienthuc"
                        value={newTags}
                        onChange={(e) => setNewTags(e.target.value)}
                        className="w-full px-3 py-2 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm placeholder-zinc-650 focus:outline-none focus:border-zinc-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      id="autoGenScript"
                      checked={autoGenScript}
                      onChange={(e) => setAutoGenScript(e.target.checked)}
                      className="w-4 h-4 rounded bg-zinc-950 border-zinc-850 text-violet-605 focus:ring-0 focus:ring-offset-0"
                    />
                    <label htmlFor="autoGenScript" className="text-xs font-medium text-zinc-300 cursor-pointer select-none">
                      Tự động gọi AI viết kịch bản chi tiết ngay sau khi tạo
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="w-full py-2.5 mt-2 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    Tạo Ý Tưởng
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Modal: Generate Video Config */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-[0_0_0_1px_rgba(63,63,70,0.32),0_24px_80px_rgba(0,0,0,0.55)]">
            <button
              onClick={() => setShowConfigModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-md hover:bg-zinc-900 text-zinc-400 hover:text-white"
              aria-label="Đóng"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="font-bold text-lg text-white mb-5 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-violet-500" />
              Cấu Hình Sinh Video
            </h3>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-400">Giọng đọc (TTS Voice)</label>
                <select
                  value={configVoice}
                  onChange={(e) => setConfigVoice(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-zinc-500"
                >
                  <option value="vi-VN-HoaiMyNeural">Tiếng Việt - Hoài My (Nữ)</option>
                  <option value="vi-VN-NamMinhNeural">Tiếng Việt - Nam Minh (Nam)</option>
                  <option value="en-US-JennyNeural">Tiếng Anh - Jenny (Nữ)</option>
                  <option value="en-US-GuyNeural">Tiếng Anh - Guy (Nam)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-400">Tỷ lệ khung hình (Aspect Ratio)</label>
                <select
                  value={configRatio}
                  onChange={(e) => setConfigRatio(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-zinc-500"
                >
                  <option value="9:16">Dọc - 9:16 (TikTok, Shorts, Reels)</option>
                  <option value="16:9">Ngang - 16:9 (YouTube)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-400">Nguồn tư liệu (Video Source)</label>
                <select
                  value={configSource}
                  onChange={(e) => setConfigSource(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-zinc-500"
                >
                  <option value="pexels">Pexels (Tải tự động)</option>
                  <option value="pixabay">Pixabay (Tải tự động)</option>
                  <option value="local">Local assets (Tư liệu cục bộ)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-400">Nhạc nền (Background Music)</label>
                <select
                  value={configBgm}
                  onChange={(e) => setConfigBgm(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-zinc-500"
                >
                  <option value="none">Không có nhạc nền</option>
                  <option value="random">Random nhạc nền hệ thống</option>
                </select>
              </div>

              <button
                onClick={handleStartGenerateVideo}
                disabled={videoJobMutation.isPending}
                className="w-full py-2.5 mt-4 rounded-md bg-violet-600 hover:bg-violet-750 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {videoJobMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Khởi tạo Job Sinh Video
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Delete Idea */}
      {ideaToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-[0_0_0_1px_rgba(63,63,70,0.32),0_24px_80px_rgba(0,0,0,0.55)]">
            <h3 className="font-bold text-lg text-white mb-2">Xác nhận xóa ý tưởng</h3>
            <p className="text-sm text-zinc-400 mb-6">
              Bạn có chắc chắn muốn xóa ý tưởng{' '}
              <span className="text-zinc-200 font-semibold">"{ideaToDelete.title}"</span>? Hành động này sẽ xóa vĩnh viễn các job và video liên quan.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIdeaToDelete(null)}
                className="px-4 py-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 font-medium text-xs hover:bg-zinc-800 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  deleteMutation.mutate(ideaToDelete.id);
                  setIdeaToDelete(null);
                }}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-md bg-rose-600 text-white font-medium text-xs hover:bg-rose-700 transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Đang xóa...' : 'Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
