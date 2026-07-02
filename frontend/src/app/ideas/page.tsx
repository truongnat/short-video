'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  ChevronRight,
  ChevronDown,
  Folder,
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
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

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

  const { data: ideas = [], isLoading, isError } = useQuery<any[]>({
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
            'queued', 'running', 'generating_script', 'fetching_materials',
            'generating_voice', 'generating_subtitle', 'rendering', 'uploading',
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

  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    if (settings) {
      if (settings.default_voice) setConfigVoice(settings.default_voice);
      if (settings.default_aspect_ratio) setConfigRatio(settings.default_aspect_ratio);
      if (settings.default_video_source) setConfigSource(settings.default_video_source);
    }
  }, [settings]);

  const selectedIdea = ideas.find((i) => i.id === selectedIdeaId) || null;

  useEffect(() => {
    if (!selectedIdea) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = originalOverflow; };
  }, [selectedIdea]);

  // Group ideas by topic
  const topics = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const idea of ideas) {
      const t = idea.topic || 'Không có chủ đề';
      if (!map.has(t)) map.set(t, []);
      map.get(t)!.push(idea);
    }
    return Array.from(map.entries())
      .map(([topic, items]) => ({ topic, ideas: items, count: items.length }))
      .sort((a, b) => b.count - a.count);
  }, [ideas]);

  const toggleTopic = (topic: string) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });
  };

  // Mutations
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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/ideas/${id}`),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['ideas'] });
      toast.success('Đã xóa ý tưởng thành công!');
      if (selectedIdeaId === deletedId) setSelectedIdeaId(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Xóa ý tưởng thất bại');
    },
  });

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

  const brainstormTopicMutation = useMutation({
    mutationFn: (payload: { topic: string; language: string; existingTitles?: string[] }) =>
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

  const batchVideoMutation = useMutation({
    mutationFn: ({ topic, config }: { topic: string; config: any }) =>
      api.post('/ideas/batch-generate-video', { topic, config }).then((res) => res.data),
    onSuccess: (data: any) => {
      toast.success(`Đã thêm ${data.count} job sinh video cho chủ đề "${data.topic}" vào hàng đợi!`);
      queryClient.invalidateQueries({ queryKey: ['ideas'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Khởi tạo hàng loạt thất bại');
    },
  });

  const [batchConfigTopic, setBatchConfigTopic] = useState<string | null>(null);

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
      const existingTitles = ideas
        .filter((i) => i.topic?.toLowerCase().trim() === newTopic.toLowerCase().trim())
        .map((i) => i.title);
      brainstormTopicMutation.mutate({
        topic: newTopic,
        language: newLang,
        existingTitles,
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

  const handleGenerateScript = (id: string) => { scriptMutation.mutate(id); };

  const handleBrainstorm = (id: string) => { brainstormMutation.mutate(id); };

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

  const handleBatchGenerateVideo = () => {
    if (!batchConfigTopic) return;
    batchVideoMutation.mutate({
      topic: batchConfigTopic,
      config: {
        voice_name: configVoice,
        aspect_ratio: configRatio,
        video_source: configSource,
        bgm_type: configBgm,
      },
    });
    setBatchConfigTopic(null);
  };

  const getJobStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      queued: 'Chờ xử lý', running: 'Đang chuẩn bị', generating_script: 'Đang viết kịch bản',
      fetching_materials: 'Đang tải tư liệu', generating_voice: 'Đang tạo giọng đọc',
      generating_subtitle: 'Đang tạo phụ đề', rendering: 'Đang render video',
      uploading: 'Đang tải lên', completed: 'Thành công', failed: 'Thất bại', cancelled: 'Đã hủy',
    };
    return labels[status] || status;
  };

  const ACTIVE_STATUSES = [
    'queued', 'running', 'generating_script', 'fetching_materials',
    'generating_voice', 'generating_subtitle', 'rendering', 'uploading',
  ];

  const isJobActive = (jobStatus: string) => ACTIVE_STATUSES.includes(jobStatus);

  const isIdeaLocked = (idea: any) => {
    if (!idea) return false;
    if (idea.status === 'generating') return true;
    const latestJob = idea.jobs?.[0];
    return latestJob && isJobActive(latestJob.status);
  };

  const renderJobStatus = (idea: any) => {
    if (idea.status === 'generating') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded-md bg-violet-950/40 text-violet-400 border border-violet-800">
          <Loader2 className="w-3 h-3 animate-spin" />
          Tạo kịch bản
        </span>
      );
    }
    const latestJob = idea.jobs?.[0];
    if (!latestJob) return <span className="text-zinc-500 text-xs font-medium">Chưa tạo video</span>;
    const status = latestJob.status;
    const progress = latestJob.progress;
    switch (status) {
      case 'queued':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded-md bg-amber-950/40 text-amber-400 border border-amber-900/50">
            <Clock className="w-3 h-3 animate-pulse" /> Chờ xử lý
          </span>
        );
      case 'running': case 'generating_script': case 'fetching_materials': case 'generating_voice':
      case 'generating_subtitle': case 'rendering': case 'uploading':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded-md bg-blue-950/40 text-blue-400 border border-blue-900/50">
            <Loader2 className="w-3 h-3 animate-spin" /> {getJobStatusLabel(status)} ({progress}%)
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded-md bg-emerald-950/40 text-emerald-400 border border-emerald-900/50">
            <CheckCircle2 className="w-3 h-3" /> Thành công
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded-md bg-rose-950/40 text-rose-400 border border-rose-900/50 cursor-help" title={latestJob.errorMessage || 'Lỗi không xác định'}>
            <AlertCircle className="w-3 h-3" /> Thất bại
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded-md bg-zinc-900 text-zinc-400 border border-zinc-800">Đã hủy</span>
        );
      default:
        return <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-md bg-zinc-900 text-zinc-400 border border-zinc-800">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-900 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-violet-500" />
            Quản lý Ý tưởng
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Quản lý ý tưởng, kịch bản và sinh video theo chủ đề.</p>
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

      {/* Topic Tree View */}
      <div className="space-y-3">
        {isError ? (
          <div className="text-center py-20 text-rose-500 text-sm border border-dashed border-rose-900/50 rounded-lg mx-4 my-4">
            Không thể tải danh sách ý tưởng. Vui lòng thử lại sau.
          </div>
        ) : isLoading ? (
          <div className="flex justify-center items-center py-24">
            <Loader2 className="w-8 h-8 text-zinc-700 animate-spin" />
          </div>
        ) : topics.length === 0 ? (
          <div className="text-center py-20 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl">
            Chưa có ý tưởng nào. Hãy tạo một ý tưởng mới để bắt đầu.
          </div>
        ) : (
          topics.map(({ topic, ideas: topicIdeas }) => {
            const isExpanded = expandedTopics.has(topic);
            const readyCount = topicIdeas.filter((i) => i.status === 'ready' && i.script).length;
            const hasAnyReady = readyCount > 0;

            return (
              <div key={topic} className="rounded-xl border border-zinc-900 bg-zinc-950 overflow-hidden">
                {/* Topic Header */}
                <button
                  onClick={() => toggleTopic(topic)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-zinc-900/30 transition-colors text-left"
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-500 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-zinc-500 flex-shrink-0" />}
                  <Folder className="w-4 h-4 text-violet-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-bold text-zinc-200">{topic}</span>
                    <span className="ml-2 text-xs text-zinc-500">{topicIdeas.length} ý tưởng</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {readyCount > 0 && (
                      <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/30 border border-emerald-900/40 px-2 py-0.5 rounded-md">
                        {readyCount} sẵn sàng
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setBatchConfigTopic(topic);
                        setShowConfigModal(true);
                      }}
                      disabled={!hasAnyReady || batchVideoMutation.isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-violet-600/20 border border-violet-800/40 text-violet-400 hover:bg-violet-600/30 text-xs font-semibold transition-all disabled:opacity-40 disabled:pointer-events-none"
                      title="Sinh video cho tất cả ý tưởng trong chủ đề"
                    >
                      <Play className="w-3 h-3 fill-violet-400" />
                      Chạy tất cả
                    </button>
                  </div>
                </button>

                {/* Ideas List (collapsible) */}
                {isExpanded && (
                  <div className="border-t border-zinc-900 divide-y divide-zinc-900/60">
                    {topicIdeas.map((idea) => {
                      const isLocked = isIdeaLocked(idea);
                      return (
                        <div
                          key={idea.id}
                          className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-900/20 transition-colors pl-12"
                        >
                          <div
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => setSelectedIdeaId(idea.id)}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-zinc-200 truncate">{idea.title}</span>
                              {idea.tags && idea.tags.length > 0 && (
                                <div className="flex gap-1 flex-shrink-0">
                                  {idea.tags.slice(0, 2).map((tag: string) => (
                                    <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-500 border border-zinc-800">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-[10px] text-zinc-600 font-medium">{idea.language === 'vi' ? 'Tiếng Việt' : 'Tiếng Anh'}</span>
                              {idea.status === 'ready' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                                  <CheckCircle2 className="w-3 h-3" /> Có kịch bản
                                </span>
                              ) : idea.status === 'generating' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] text-violet-400 font-medium">
                                  <Loader2 className="w-3 h-3 animate-spin" /> Đang viết...
                                </span>
                              ) : (
                                <span className="text-[10px] text-zinc-600 font-medium">Chưa viết</span>
                              )}
                            </div>
                          </div>

                          <div className="flex-shrink-0">{renderJobStatus(idea)}</div>

                          <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setSelectedIdeaId(idea.id)}
                              className="p-1.5 rounded-md hover:bg-zinc-900 text-zinc-500 hover:text-zinc-200 transition-colors"
                              title="Xem nhanh"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {!idea.script && (
                              <button
                                disabled={isLocked || scriptMutation.isPending}
                                onClick={() => handleGenerateScript(idea.id)}
                                className="p-1.5 rounded-md hover:bg-zinc-900 text-zinc-500 hover:text-violet-400 transition-colors disabled:opacity-30"
                                title="Viết kịch bản"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              disabled={isLocked || brainstormMutation.isPending}
                              onClick={() => handleBrainstorm(idea.id)}
                              className="p-1.5 rounded-md hover:bg-zinc-900 text-zinc-500 hover:text-violet-400 transition-colors disabled:opacity-30"
                              title="Gợi ý thêm"
                            >
                              {brainstormMutation.isPending && brainstormMutation.variables === idea.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Sparkles className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <Link
                              href={`/ideas/${idea.id}`}
                              className="p-1.5 rounded-md hover:bg-zinc-900 text-zinc-500 hover:text-zinc-200 transition-colors"
                              title="Trang chi tiết"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                            <button
                              disabled={isLocked}
                              onClick={() => setIdeaToDelete(idea)}
                              className="p-1.5 rounded-md hover:bg-zinc-900 text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-30"
                              title="Xóa"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Drawer: Idea Inspector */}
      {isMounted && selectedIdea && createPortal(
        <>
          <button type="button" aria-label="Đóng drawer" onClick={() => setSelectedIdeaId(null)} className="fixed inset-0 z-40 bg-black/65 backdrop-blur-[2px]" />
          <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl border-l border-zinc-800 bg-zinc-950/98 shadow-2xl">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-6 py-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-600">Idea Inspector</p>
                  <h2 className="mt-1 text-sm font-semibold text-zinc-200">Xem nhanh và thao tác</h2>
                </div>
                <button type="button" onClick={() => setSelectedIdeaId(null)} className="rounded-md border border-zinc-700 bg-zinc-900/80 p-2 text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-200" aria-label="Đóng">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-start gap-4">
                      <h3 className="font-bold text-lg text-white leading-tight">{selectedIdea.title}</h3>
                      <div className="flex items-center gap-2">
                        <Link href={`/ideas/${selectedIdea.id}`} className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-400 hover:text-zinc-200 transition-colors">
                          ID <ExternalLink className="w-3 h-3" />
                        </Link>
                        <span className="text-xs font-semibold text-zinc-400 uppercase bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">{selectedIdea.language}</span>
                      </div>
                    </div>
                    <p className="text-xs text-violet-400 mt-2 font-medium">Chủ đề: {selectedIdea.topic}</p>
                    {selectedIdea.description && (
                      <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs leading-relaxed text-zinc-300">
                        <strong>Yêu cầu kịch bản:</strong> {selectedIdea.description}
                      </div>
                    )}
                  </div>

                  {/* Active job progress */}
                  {(() => {
                    const latestJob = selectedIdea.jobs?.[0];
                    const isActive = latestJob && isJobActive(latestJob.status);
                    const isScriptGen = selectedIdea.status === 'generating';
                    if (isScriptGen) {
                      return (
                        <div className="p-4 rounded-md border border-violet-900/30 bg-violet-950/10 space-y-3">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-violet-400 font-semibold flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tạo kịch bản chi tiết...</span>
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
                            <span className="text-blue-400 font-semibold flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {getJobStatusLabel(latestJob.status)}...</span>
                            <span className="text-zinc-400 font-medium">{latestJob.progress}%</span>
                          </div>
                          <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${latestJob.progress}%` }} />
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Script */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-zinc-400 flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Nội dung kịch bản</label>
                      {selectedIdea.script && (
                        <button disabled={scriptMutation.isPending || isIdeaLocked(selectedIdea)} onClick={() => handleGenerateScript(selectedIdea.id)} className="text-[11px] font-bold text-violet-400 hover:text-violet-300 flex items-center gap-1 disabled:opacity-50 transition-colors">
                          {scriptMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                          AI viết lại
                        </button>
                      )}
                    </div>
                    {selectedIdea.script ? (
                      <div className="max-h-[300px] overflow-y-auto whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-900/55 p-4 font-mono text-xs leading-relaxed text-zinc-300">
                        {selectedIdea.script}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-4 rounded-lg border border-dashed border-zinc-700 bg-zinc-950/70 p-6 text-center">
                        <div className="p-3 rounded-full bg-violet-500/5 border border-violet-500/10"><Sparkles className="w-5 h-5 text-violet-400" /></div>
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold text-zinc-300">Chưa có kịch bản</h4>
                          <p className="text-[11px] text-zinc-500 max-w-[220px] mx-auto leading-normal">Hãy để AI viết kịch bản chi tiết dựa trên thông tin ý tưởng này.</p>
                        </div>
                        <button disabled={scriptMutation.isPending || isIdeaLocked(selectedIdea)} onClick={() => handleGenerateScript(selectedIdea.id)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold text-xs shadow-sm transition-all disabled:opacity-50">
                          {scriptMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          AI Tự Động Viết Kịch Bản
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setShowConfigModal(true)}
                    disabled={!selectedIdea.script || isIdeaLocked(selectedIdea)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs shadow-sm transition-colors disabled:opacity-40 disabled:pointer-events-none"
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
          <div className="relative w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <button onClick={() => setShowCreateModal(false)} className="absolute top-4 right-4 p-1.5 rounded-md hover:bg-zinc-900 text-zinc-500 hover:text-white" aria-label="Đóng"><X className="w-4 h-4" /></button>
            <h3 className="font-bold text-lg text-white mb-5 flex items-center gap-2"><Plus className="w-5 h-5 text-violet-500" /> Thêm Ý Tưởng Mới</h3>

            <div className="flex border-b border-zinc-900 mb-5">
              <button type="button" onClick={() => setActiveTab('ai')} className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'ai' ? 'border-violet-500 text-violet-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
                AI Tự Động Gợi Ý (5 Ý Tưởng)
              </button>
              <button type="button" onClick={() => setActiveTab('manual')} className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'manual' ? 'border-violet-500 text-violet-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
                Tạo Thủ Công
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {activeTab === 'ai' ? (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-400">Chủ đề gốc để AI gợi ý *</label>
                    <input type="text" required placeholder="Ví dụ: Lịch sử nhà Trần, kiến thức vũ trụ thú vị..." value={newTopic} onChange={(e) => setNewTopic(e.target.value)}
                      className="w-full px-3 py-2 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm placeholder-zinc-600 focus:outline-none focus:border-zinc-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-400">Ngôn ngữ kịch bản</label>
                    <select value={newLang} onChange={(e) => setNewLang(e.target.value)}
                      className="w-full px-3 py-2 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-zinc-500">
                      <option value="vi">Tiếng Việt (vi)</option>
                      <option value="en">Tiếng Anh (en)</option>
                    </select>
                  </div>
                  <p className="text-[10px] text-zinc-600">AI sẽ tự động bỏ qua các ý tưởng trùng với những ý tưởng đã có trong chủ đề này.</p>
                  <button type="submit" disabled={brainstormTopicMutation.isPending}
                    className="w-full py-2.5 mt-4 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                    {brainstormTopicMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    AI Gợi Ý & Tự Động Viết 5 Kịch Bản
                  </button>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-400">Tiêu đề ý tưởng *</label>
                    <input type="text" required placeholder="Ví dụ: Bí ẩn cấu trúc cây cầu Vàng Đà Nẵng" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm placeholder-zinc-600 focus:outline-none focus:border-zinc-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-400">Chủ đề gốc *</label>
                    <input type="text" required placeholder="Ví dụ: Du lịch Việt Nam" value={newTopic} onChange={(e) => setNewTopic(e.target.value)}
                      className="w-full px-3 py-2 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm placeholder-zinc-600 focus:outline-none focus:border-zinc-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-400">Mô tả ngắn / Yêu cầu viết</label>
                    <textarea placeholder="Ví dụ: Kịch bản dài khoảng 3 câu, cuốn hút, nhấn mạnh sự độc đáo của..." value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3}
                      className="w-full px-3 py-2 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm placeholder-zinc-600 focus:outline-none focus:border-zinc-500 resize-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-400">Ngôn ngữ</label>
                      <select value={newLang} onChange={(e) => setNewLang(e.target.value)}
                        className="w-full px-3 py-2 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-zinc-500">
                        <option value="vi">Tiếng Việt (vi)</option>
                        <option value="en">Tiếng Anh (en)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-400">Tags (phân cách bởi dấu phẩy)</label>
                      <input type="text" placeholder="dulich, kienthuc" value={newTags} onChange={(e) => setNewTags(e.target.value)}
                        className="w-full px-3 py-2 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm placeholder-zinc-600 focus:outline-none focus:border-zinc-500" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 py-1">
                    <input type="checkbox" id="autoGenScript" checked={autoGenScript} onChange={(e) => setAutoGenScript(e.target.checked)}
                      className="w-4 h-4 rounded bg-zinc-950 border-zinc-800 text-violet-600 focus:ring-0 focus:ring-offset-0" />
                    <label htmlFor="autoGenScript" className="text-xs font-medium text-zinc-300 cursor-pointer select-none">Tự động gọi AI viết kịch bản chi tiết ngay sau khi tạo</label>
                  </div>
                  <button type="submit" disabled={createMutation.isPending}
                    className="w-full py-2.5 mt-2 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50">
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
          <div className="relative w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <button onClick={() => { setShowConfigModal(false); setBatchConfigTopic(null); }} className="absolute top-4 right-4 p-1.5 rounded-md hover:bg-zinc-900 text-zinc-400 hover:text-white" aria-label="Đóng"><X className="w-4 h-4" /></button>
            <h3 className="font-bold text-lg text-white mb-5 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-violet-500" />
              {batchConfigTopic ? `Sinh Video: ${batchConfigTopic}` : 'Cấu Hình Sinh Video'}
            </h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-400">Giọng đọc (TTS Voice)</label>
                <select value={configVoice} onChange={(e) => setConfigVoice(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-zinc-500">
                  <option value="vi-VN-HoaiMyNeural">Tiếng Việt - Hoài My (Nữ)</option>
                  <option value="vi-VN-NamMinhNeural">Tiếng Việt - Nam Minh (Nam)</option>
                  <option value="en-US-JennyNeural">Tiếng Anh - Jenny (Nữ)</option>
                  <option value="en-US-GuyNeural">Tiếng Anh - Guy (Nam)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-400">Tỷ lệ khung hình (Aspect Ratio)</label>
                <select value={configRatio} onChange={(e) => setConfigRatio(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-zinc-500">
                  <option value="9:16">Dọc - 9:16 (TikTok, Shorts, Reels)</option>
                  <option value="16:9">Ngang - 16:9 (YouTube)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-400">Nguồn tư liệu (Video Source)</label>
                <select value={configSource} onChange={(e) => setConfigSource(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-zinc-500">
                  <option value="pexels">Pexels (Tải tự động)</option>
                  <option value="pixabay">Pixabay (Tải tự động)</option>
                  <option value="local">Local assets (Tư liệu cục bộ)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-400">Nhạc nền (Background Music)</label>
                <select value={configBgm} onChange={(e) => setConfigBgm(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-zinc-500">
                  <option value="none">Không có nhạc nền</option>
                  <option value="random">Random nhạc nền hệ thống</option>
                </select>
              </div>
              {batchConfigTopic ? (
                <button
                  onClick={handleBatchGenerateVideo}
                  disabled={batchVideoMutation.isPending}
                  className="w-full py-2.5 mt-4 rounded-md bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {batchVideoMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
                  {batchVideoMutation.isPending ? 'Đang tạo...' : `Chạy tất cả (${batchConfigTopic})`}
                </button>
              ) : (
                <button
                  onClick={handleStartGenerateVideo}
                  disabled={videoJobMutation.isPending}
                  className="w-full py-2.5 mt-4 rounded-md bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {videoJobMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Khởi tạo Job Sinh Video
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Delete Idea */}
      {ideaToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <h3 className="font-bold text-lg text-white mb-2">Xác nhận xóa ý tưởng</h3>
            <p className="text-sm text-zinc-400 mb-6">
              Bạn có chắc chắn muốn xóa ý tưởng{' '}
              <span className="text-zinc-200 font-semibold">"{ideaToDelete.title}"</span>? Hành động này sẽ xóa vĩnh viễn các job và video liên quan.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setIdeaToDelete(null)} className="px-4 py-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 font-medium text-xs hover:bg-zinc-800 transition-colors">Hủy</button>
              <button onClick={() => { deleteMutation.mutate(ideaToDelete.id); setIdeaToDelete(null); }} disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-md bg-rose-600 text-white font-medium text-xs hover:bg-rose-700 transition-colors disabled:opacity-50">
                {deleteMutation.isPending ? 'Đang xóa...' : 'Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}