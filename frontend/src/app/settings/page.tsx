'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  Settings,
  Save,
  Key,
  Sliders,
  Database,
  Loader2,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  Zap,
} from 'lucide-react';

// -------------------------------------------------------------------
// LLM Provider definitions
// -------------------------------------------------------------------
const LLM_PROVIDERS = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Gemini 2.5 Flash / Pro',
    apiKeyField: 'gemini_api_key',
    modelField: 'gemini_model_name',
    defaultModel: 'gemini-2.5-flash',
    keyPlaceholder: 'AIza…',
    keyHint: 'Lấy key tại: aistudio.google.com',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-900/40',
  },
  {
    id: 'groq',
    name: 'Groq Cloud',
    description: 'Llama 3.3 70B / 8B siêu nhanh',
    apiKeyField: 'groq_api_key',
    modelField: 'groq_model_name',
    defaultModel: 'llama-3.3-70b-versatile',
    keyPlaceholder: 'gsk_…',
    keyHint: 'Lấy key tại: console.groq.com',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-900/40',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o / GPT-4o-mini',
    apiKeyField: 'openai_api_key',
    modelField: 'openai_model_name',
    defaultModel: 'gpt-4o-mini',
    keyPlaceholder: 'sk-…',
    keyHint: 'Lấy key tại: platform.openai.com',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-900/40',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'DeepSeek Chat / Reasoner',
    apiKeyField: 'deepseek_api_key',
    modelField: 'deepseek_model_name',
    defaultModel: 'deepseek-chat',
    keyPlaceholder: 'sk-…',
    keyHint: 'Lấy key tại: platform.deepseek.com',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-900/40',
  },
  {
    id: 'moonshot',
    name: 'Moonshot (Kimi)',
    description: 'Moonshot v1-8k / 32k / 128k',
    apiKeyField: 'moonshot_api_key',
    modelField: 'moonshot_model_name',
    defaultModel: 'moonshot-v1-8k',
    keyPlaceholder: 'sk-…',
    keyHint: 'Lấy key tại: platform.moonshot.cn',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-900/40',
  },
  {
    id: 'qwen',
    name: 'Alibaba Qwen',
    description: 'Qwen-Max / Qwen-Plus',
    apiKeyField: 'qwen_api_key',
    modelField: 'qwen_model_name',
    defaultModel: 'qwen-max',
    keyPlaceholder: 'sk-…',
    keyHint: 'Lấy key tại: dashscope.aliyun.com',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-900/40',
  },
  {
    id: 'azure',
    name: 'Azure OpenAI',
    description: 'GPT-4 / GPT-3.5 Turbo qua Azure',
    apiKeyField: 'azure_api_key',
    modelField: 'azure_model_name',
    defaultModel: 'gpt-35-turbo',
    keyPlaceholder: 'Azure API Key…',
    keyHint: 'Cần cấu hình thêm Azure Base URL',
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-900/40',
  },
  {
    id: 'grok',
    name: 'xAI Grok',
    description: 'Grok-4 từ xAI',
    apiKeyField: 'grok_api_key',
    modelField: 'grok_model_name',
    defaultModel: 'grok-4.3',
    keyPlaceholder: 'xai-…',
    keyHint: 'Lấy key tại: console.x.ai',
    color: 'text-zinc-300',
    bg: 'bg-zinc-500/10',
    border: 'border-zinc-700/40',
  },
  {
    id: 'volcengine',
    name: 'Volcengine (Doubao)',
    description: 'Doubao Seed 2.1 Turbo',
    apiKeyField: 'volcengine_api_key',
    modelField: 'volcengine_model_name',
    defaultModel: 'doubao-seed-2-1-turbo-260628',
    keyPlaceholder: 'API Key…',
    keyHint: 'Nền tảng AI của Bytedance',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-900/40',
  },
];

// -------------------------------------------------------------------
// Helper: mask API key for display
// -------------------------------------------------------------------
function ApiKeyInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 pr-9 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-600 font-mono placeholder-zinc-600"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
        tabIndex={-1}
      >
        {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

// -------------------------------------------------------------------
// Main Component
// -------------------------------------------------------------------
export default function SystemSettings() {
  const queryClient = useQueryClient();

  // Flat state: provider -> { apiKey, model }
  const [activeProvider, setActiveProvider] = useState('gemini');
  const [providerState, setProviderState] = useState<
    Record<string, { apiKey: string; model: string }>
  >(() =>
    Object.fromEntries(
      LLM_PROVIDERS.map((p) => [p.id, { apiKey: '', model: p.defaultModel }])
    )
  );

  // Other settings
  const [voice, setVoice] = useState('vi-VN-HoaiMyNeural');
  const [ratio, setRatio] = useState('9:16');
  const [source, setSource] = useState('pexels');

  const [savedOk, setSavedOk] = useState(false);

  const { data = {}, isLoading } = useQuery<any>({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then((res) => res.data),
  });

  // Hydrate form from fetched settings
  useEffect(() => {
    if (!data || Object.keys(data).length === 0) return;

    if (data.llm_provider) setActiveProvider(data.llm_provider);
    if (data.default_voice) setVoice(data.default_voice);
    if (data.default_aspect_ratio) setRatio(data.default_aspect_ratio);
    if (data.default_video_source) setSource(data.default_video_source);

    setProviderState((prev) => {
      const next = { ...prev };
      for (const p of LLM_PROVIDERS) {
        next[p.id] = {
          apiKey: data[p.apiKeyField] ?? prev[p.id]?.apiKey ?? '',
          model: data[p.modelField] ?? prev[p.id]?.model ?? p.defaultModel,
        };
      }
      return next;
    });
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, string>) => api.patch('/settings', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const payload: Record<string, string> = {
      llm_provider: activeProvider,
      default_voice: voice,
      default_aspect_ratio: ratio,
      default_video_source: source,
    };

    for (const p of LLM_PROVIDERS) {
      payload[p.apiKeyField] = providerState[p.id]?.apiKey ?? '';
      payload[p.modelField] = providerState[p.id]?.model ?? p.defaultModel;
    }

    saveMutation.mutate(payload);
  };

  const updateProviderField = (
    providerId: string,
    field: 'apiKey' | 'model',
    value: string
  ) => {
    setProviderState((prev) => ({
      ...prev,
      [providerId]: { ...prev[providerId], [field]: value },
    }));
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-zinc-400" />
          Cấu hình Hệ thống
        </h2>
        <p className="text-xs text-zinc-500 mt-1">
          Quản lý các khóa API AI, tham số sinh video mặc định và lưu trữ.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-7 h-7 text-zinc-600 animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* ─── LLM Providers Table ─── */}
          <div className="rounded-lg border border-zinc-900 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-zinc-900 bg-zinc-950">
              <Key className="w-4 h-4 text-zinc-400" />
              <h3 className="text-sm font-semibold text-white">Cấu hình AI (LLM Providers)</h3>
              <span className="ml-auto text-[10px] text-zinc-500 font-medium">
                Chọn provider đang dùng → nhập API Key → lưu
              </span>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-[1.6fr_2.4fr_1.8fr_auto] gap-0 text-[10px] font-bold text-zinc-600 uppercase tracking-wider px-5 py-2 border-b border-zinc-900/60 bg-zinc-950/50">
              <span>Provider</span>
              <span>API Key</span>
              <span>Model Name</span>
              <span className="text-right pr-1">Active</span>
            </div>

            {/* Provider rows */}
            <div className="divide-y divide-zinc-900/60 bg-zinc-950">
              {LLM_PROVIDERS.map((p) => {
                const state = providerState[p.id] ?? { apiKey: '', model: p.defaultModel };
                const isConfigured = state.apiKey.trim().length > 0;
                const isActive = activeProvider === p.id;

                return (
                  <div
                    key={p.id}
                    className={`grid grid-cols-[1.6fr_2.4fr_1.8fr_auto] gap-3 items-center px-5 py-3.5 transition-colors ${
                      isActive ? 'bg-zinc-900/40' : 'hover:bg-zinc-900/20'
                    }`}
                  >
                    {/* Provider name */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-7 h-7 rounded-md ${p.bg} border ${p.border} flex items-center justify-center flex-shrink-0`}>
                        <Zap className={`w-3.5 h-3.5 ${p.color}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-zinc-200 truncate">{p.name}</p>
                        <p className="text-[10px] text-zinc-600 truncate">{p.description}</p>
                      </div>
                    </div>

                    {/* API Key input */}
                    <div className="space-y-1">
                      <ApiKeyInput
                        value={state.apiKey}
                        onChange={(v) => updateProviderField(p.id, 'apiKey', v)}
                        placeholder={p.keyPlaceholder}
                      />
                      <div className="flex items-center gap-1.5">
                        {isConfigured ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3 h-3" /> Đã cấu hình
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-zinc-600 font-medium">
                            <Circle className="w-3 h-3" /> Chưa nhập key
                          </span>
                        )}
                        <span className="text-[10px] text-zinc-700 hidden sm:inline">· {p.keyHint}</span>
                      </div>
                    </div>

                    {/* Model input */}
                    <div>
                      <input
                        type="text"
                        value={state.model}
                        onChange={(e) => updateProviderField(p.id, 'model', e.target.value)}
                        placeholder={p.defaultModel}
                        className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-600 font-mono placeholder-zinc-600"
                      />
                    </div>

                    {/* Active radio */}
                    <div className="flex justify-end pr-1">
                      <button
                        type="button"
                        onClick={() => setActiveProvider(p.id)}
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                          isActive
                            ? 'border-zinc-200 bg-zinc-200'
                            : 'border-zinc-700 hover:border-zinc-500'
                        }`}
                        title={`Dùng ${p.name}`}
                      >
                        {isActive && <div className="w-2 h-2 rounded-full bg-zinc-950" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Active provider summary */}
            <div className="px-5 py-3 border-t border-zinc-900 bg-zinc-950/50 flex items-center gap-2">
              <span className="text-[11px] text-zinc-500">Provider đang dùng:</span>
              <span className="text-[11px] font-bold text-zinc-200">
                {LLM_PROVIDERS.find((p) => p.id === activeProvider)?.name ?? activeProvider}
              </span>
              {providerState[activeProvider]?.apiKey ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-3 h-3" /> Key đã nhập
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-semibold">
                  ⚠ Chưa nhập API key cho provider này
                </span>
              )}
            </div>
          </div>

          {/* ─── Video Defaults ─── */}
          <div className="rounded-lg border border-zinc-900 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-zinc-900 bg-zinc-950">
              <Sliders className="w-4 h-4 text-zinc-400" />
              <h3 className="text-sm font-semibold text-white">Thiết lập Video Mặc định</h3>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4 bg-zinc-950">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Giọng đọc (TTS)
                </label>
                <select
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-600"
                >
                  <option value="vi-VN-HoaiMyNeural">Hoài My (Nữ - Tiếng Việt)</option>
                  <option value="vi-VN-NamMinhNeural">Nam Minh (Nam - Tiếng Việt)</option>
                  <option value="en-US-JennyNeural">Jenny (Female - English)</option>
                  <option value="en-US-GuyNeural">Guy (Male - English)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Tỷ lệ khung hình
                </label>
                <select
                  value={ratio}
                  onChange={(e) => setRatio(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-600"
                >
                  <option value="9:16">9:16 — Dọc (TikTok / Shorts)</option>
                  <option value="16:9">16:9 — Ngang (YouTube)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Nguồn tư liệu hình ảnh
                </label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-600"
                >
                  <option value="pexels">Pexels API</option>
                  <option value="pixabay">Pixabay API</option>
                  <option value="local">Local (Thư mục cục bộ)</option>
                </select>
              </div>
            </div>
          </div>

          {/* ─── Storage Info ─── */}
          <div className="rounded-lg border border-zinc-900 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-zinc-900 bg-zinc-950">
              <Database className="w-4 h-4 text-zinc-400" />
              <h3 className="text-sm font-semibold text-white">Lưu trữ Object Storage (MinIO)</h3>
            </div>
            <div className="p-5 bg-zinc-950">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Endpoint', value: 'minio:9000' },
                  { label: 'Bucket', value: 'videos' },
                  { label: 'Username', value: 'minioadmin' },
                  { label: 'Console', value: 'localhost:9001' },
                ].map((item) => (
                  <div key={item.label} className="p-3 rounded-md bg-zinc-900 border border-zinc-850">
                    <p className="text-[10px] text-zinc-600 font-semibold uppercase tracking-wider">{item.label}</p>
                    <p className="text-xs text-zinc-300 font-mono mt-1">{item.value}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-zinc-600 mt-3">
                MinIO được tích hợp tự động qua Docker Compose. Không cần cấu hình thêm.
              </p>
            </div>
          </div>

          {/* ─── Save Button ─── */}
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-semibold text-sm shadow-sm transition-all disabled:opacity-50"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Lưu cấu hình
            </button>

            {savedOk && (
              <span className="inline-flex items-center gap-1.5 text-sm text-emerald-400 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                Đã lưu thành công!
              </span>
            )}
            {saveMutation.isError && (
              <span className="text-sm text-rose-400 font-semibold">
                Lưu thất bại. Vui lòng thử lại.
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
