"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  Settings,
  Save,
  Key,
  Database,
  Loader2,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  Zap,
  Image,
  Mic,
  Video,
  Cpu,
  type LucideIcon,
} from "lucide-react";

// -------------------------------------------------------------------
// LLM Provider definitions
// -------------------------------------------------------------------
const LLM_PROVIDERS = [
  {
    id: "gemini",
    name: "Google Gemini",
    description: "Gemini 2.5 Flash / Pro",
    apiKeyField: "gemini_api_key",
    modelField: "gemini_model_name",
    defaultModel: "gemini-2.5-flash",
    keyPlaceholder: "AIza…",
    keyHint: "aistudio.google.com",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-900/40",
  },
  {
    id: "groq",
    name: "Groq Cloud",
    description: "Llama 3.3 70B / 8B",
    apiKeyField: "groq_api_key",
    modelField: "groq_model_name",
    defaultModel: "llama-3.3-70b-versatile",
    keyPlaceholder: "gsk_…",
    keyHint: "console.groq.com",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-900/40",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT-4o / GPT-4o-mini",
    apiKeyField: "openai_api_key",
    modelField: "openai_model_name",
    defaultModel: "gpt-4o-mini",
    keyPlaceholder: "sk-…",
    keyHint: "platform.openai.com",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-900/40",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    description: "DeepSeek Chat / Reasoner",
    apiKeyField: "deepseek_api_key",
    modelField: "deepseek_model_name",
    defaultModel: "deepseek-chat",
    keyPlaceholder: "sk-…",
    keyHint: "platform.deepseek.com",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-900/40",
  },
  {
    id: "moonshot",
    name: "Moonshot (Kimi)",
    description: "Moonshot v1-8k / 32k / 128k",
    apiKeyField: "moonshot_api_key",
    modelField: "moonshot_model_name",
    defaultModel: "moonshot-v1-8k",
    keyPlaceholder: "sk-…",
    keyHint: "platform.moonshot.cn",
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
    border: "border-indigo-900/40",
  },
  {
    id: "qwen",
    name: "Alibaba Qwen",
    description: "Qwen-Max / Qwen-Plus",
    apiKeyField: "qwen_api_key",
    modelField: "qwen_model_name",
    defaultModel: "qwen-max",
    keyPlaceholder: "sk-…",
    keyHint: "dashscope.aliyun.com",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-900/40",
  },
  {
    id: "azure",
    name: "Azure OpenAI",
    description: "GPT-4 / GPT-3.5 Turbo qua Azure",
    apiKeyField: "azure_api_key",
    modelField: "azure_model_name",
    defaultModel: "gpt-35-turbo",
    keyPlaceholder: "Azure API Key…",
    keyHint: "Cần thêm Azure Base URL",
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-900/40",
  },
  {
    id: "grok",
    name: "xAI Grok",
    description: "Grok-4 từ xAI",
    apiKeyField: "grok_api_key",
    modelField: "grok_model_name",
    defaultModel: "grok-4.3",
    keyPlaceholder: "xai-…",
    keyHint: "console.x.ai",
    color: "text-zinc-300",
    bg: "bg-zinc-500/10",
    border: "border-zinc-700/40",
  },
  {
    id: "volcengine",
    name: "Volcengine (Doubao)",
    description: "Doubao Seed 2.1 Turbo",
    apiKeyField: "volcengine_api_key",
    modelField: "volcengine_model_name",
    defaultModel: "doubao-seed-2-1-turbo-260628",
    keyPlaceholder: "API Key…",
    keyHint: "Nền tảng AI Bytedance",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-900/40",
  },
];

// -------------------------------------------------------------------
// Tabs
// -------------------------------------------------------------------
const TABS = [
  { id: "llm", label: "AI Providers", icon: Zap },
  { id: "media", label: "Media Sources", icon: Image },
  { id: "tts", label: "TTS & Voice", icon: Mic },
  { id: "video", label: "Video Defaults", icon: Video },
  { id: "advanced", label: "Advanced", icon: Cpu },
] as const;

type TabId = (typeof TABS)[number]["id"];
type ProviderDraft = { apiKey: string | null; model: string | null };
type SettingsData = Record<string, string | undefined>;

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null) {
    const maybeError = error as {
      response?: { data?: { message?: unknown } };
      message?: unknown;
    };
    if (typeof maybeError.response?.data?.message === "string") {
      return maybeError.response.data.message;
    }
    if (typeof maybeError.message === "string") {
      return maybeError.message;
    }
  }

  return fallback;
}

// -------------------------------------------------------------------
// Helpers
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
        type={show ? "text" : "password"}
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
        {show ? (
          <EyeOff className="w-3.5 h-3.5" />
        ) : (
          <Eye className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-600 font-mono placeholder-zinc-600"
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-600"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-900 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-zinc-900 bg-zinc-950">
        <Icon className="w-4 h-4 text-zinc-400" />
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {description && (
          <span className="ml-auto text-[10px] text-zinc-500 font-medium">
            {description}
          </span>
        )}
      </div>
      <div className="bg-zinc-950">{children}</div>
    </div>
  );
}

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-3.5 border-b border-zinc-900/60 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-shrink-0 min-w-[140px]">
          <p className="text-xs font-semibold text-zinc-300">{label}</p>
          {hint && <p className="text-[10px] text-zinc-600 mt-0.5">{hint}</p>}
        </div>
        <div className="flex-1 max-w-md">{children}</div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------
// Main Component
// -------------------------------------------------------------------
export default function SystemSettings() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("llm");

  // LLM state
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [providerState, setProviderState] = useState<
    Record<string, ProviderDraft>
  >(() =>
    Object.fromEntries(
      LLM_PROVIDERS.map((p) => [p.id, { apiKey: null, model: null }]),
    ),
  );

  // Media source state
  const [pexelsApiKeys, setPexelsApiKeys] = useState<string | null>(null);
  const [pixabayApiKeys, setPixabayApiKeys] = useState<string | null>(null);
  const [coverrApiKeys, setCoverrApiKeys] = useState<string | null>(null);
  const [twelvelabsApiKeys, setTwelvelabsApiKeys] = useState<string | null>(
    null,
  );
  const [twelvelabsRerank, setTwelvelabsRerank] = useState<string | null>(null);

  // TTS state
  const [voice, setVoice] = useState<string | null>(null);
  const [speechKey, setSpeechKey] = useState<string | null>(null);
  const [speechRegion, setSpeechRegion] = useState<string | null>(null);
  const [elevenlabsApiKey, setElevenlabsApiKey] = useState<string | null>(null);
  const [elevenlabsModelId, setElevenlabsModelId] = useState<string | null>(
    null,
  );
  const [siliconflowApiKey, setSiliconflowApiKey] = useState<string | null>(
    null,
  );
  const [chatterboxBaseUrl, setChatterboxBaseUrl] = useState<string | null>(
    null,
  );

  // Video defaults state
  const [ratio, setRatio] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [subtitleProvider, setSubtitleProvider] = useState<string | null>(null);
  const [edgeTtsTimeout, setEdgeTtsTimeout] = useState<string | null>(null);

  // Advanced state
  const [tlsVerify, setTlsVerify] = useState<string | null>(null);
  const [enableRedis, setEnableRedis] = useState<string | null>(null);
  const [whisperModelSize, setWhisperModelSize] = useState<string | null>(null);
  const [whisperDevice, setWhisperDevice] = useState<string | null>(null);
  const [whisperComputeType, setWhisperComputeType] = useState<string | null>(
    null,
  );

  const [savedOk, setSavedOk] = useState(false);

  const {
    data = {} as SettingsData,
    isLoading,
    isError,
  } = useQuery<SettingsData>({
    queryKey: ["settings"],
    queryFn: () => api.get("/settings").then((res) => res.data),
  });
  const getValue = (draft: string | null, key: string, fallback = "") =>
    draft ?? data[key] ?? fallback;
  const effectiveActiveProvider =
    activeProvider ?? data.llm_provider ?? "gemini";

  const [saveError, setSaveError] = useState("");

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, string>) =>
      api.patch("/settings", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setSavedOk(true);
      setSaveError("");
      setTimeout(() => setSavedOk(false), 3000);
    },
    onError: (error: unknown) => {
      setSaveError(getErrorMessage(error, "Lỗi không xác định"));
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const payload: Record<string, string> = {
      llm_provider: effectiveActiveProvider,
      default_voice: getValue(voice, "default_voice", "vi-VN-HoaiMyNeural"),
      default_aspect_ratio: getValue(ratio, "default_aspect_ratio", "9:16"),
      default_video_source: getValue(source, "default_video_source", "pexels"),
      pexels_api_keys: getValue(pexelsApiKeys, "pexels_api_keys"),
      pixabay_api_keys: getValue(pixabayApiKeys, "pixabay_api_keys"),
      coverr_api_keys: getValue(coverrApiKeys, "coverr_api_keys"),
      twelvelabs_api_keys: getValue(twelvelabsApiKeys, "twelvelabs_api_keys"),
      twelvelabs_rerank_terms: getValue(
        twelvelabsRerank,
        "twelvelabs_rerank_terms",
        "false",
      ),
      speech_key: getValue(speechKey, "speech_key"),
      speech_region: getValue(speechRegion, "speech_region"),
      elevenlabs_api_key: getValue(elevenlabsApiKey, "elevenlabs_api_key"),
      elevenlabs_model_id: getValue(
        elevenlabsModelId,
        "elevenlabs_model_id",
        "eleven_multilingual_v2",
      ),
      siliconflow_api_key: getValue(siliconflowApiKey, "siliconflow_api_key"),
      chatterbox_base_url: getValue(
        chatterboxBaseUrl,
        "chatterbox_base_url",
        "http://127.0.0.1:4123/v1",
      ),
      subtitle_provider: getValue(
        subtitleProvider,
        "subtitle_provider",
        "edge",
      ),
      edge_tts_timeout: getValue(edgeTtsTimeout, "edge_tts_timeout", "30"),
      tls_verify: getValue(tlsVerify, "tls_verify", "true"),
      enable_redis: getValue(enableRedis, "enable_redis", "false"),
      whisper_model_size: getValue(
        whisperModelSize,
        "whisper_model_size",
        "large-v3",
      ),
      whisper_device: getValue(whisperDevice, "whisper_device", "CPU"),
      whisper_compute_type: getValue(
        whisperComputeType,
        "whisper_compute_type",
        "int8",
      ),
    };

    for (const p of LLM_PROVIDERS) {
      const draft = providerState[p.id] ?? { apiKey: null, model: null };
      payload[p.apiKeyField] = draft.apiKey ?? data[p.apiKeyField] ?? "";
      payload[p.modelField] =
        draft.model ?? data[p.modelField] ?? p.defaultModel;
    }

    saveMutation.mutate(payload);
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-zinc-400" />
          Cấu hình Hệ thống
        </h2>
        <p className="text-xs text-zinc-500 mt-1">
          Quản lý khóa API, nguồn tư liệu, giọng đọc và tham số mặc định cho
          engine.
        </p>
      </div>

      {isError ? (
        <div className="flex justify-center items-center py-20">
          <p className="text-sm text-rose-400">
            Không thể tải cấu hình. Vui lòng thử lại sau.
          </p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-7 h-7 text-zinc-600 animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* ─── Tabs ─── */}
          <div className="flex gap-1 border-b border-zinc-900">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold transition-all border-b-2 -mb-px ${
                    isActive
                      ? "border-zinc-200 text-zinc-200"
                      : "border-transparent text-zinc-600 hover:text-zinc-400 hover:border-zinc-700"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* ─── Tab: LLM ─── */}
          {activeTab === "llm" && (
            <SectionCard
              icon={Key}
              title="AI Providers (LLM)"
              description="Chọn provider đang dùng → nhập API Key → lưu"
            >
              <div className="grid grid-cols-[1.6fr_2.4fr_1.8fr_auto] gap-0 text-[10px] font-bold text-zinc-600 uppercase tracking-wider px-5 py-2 border-b border-zinc-900/60 bg-zinc-950/50">
                <span>Provider</span>
                <span>API Key</span>
                <span>Model Name</span>
                <span className="text-right pr-1">Active</span>
              </div>
              <div className="divide-y divide-zinc-900/60 bg-zinc-950">
                {LLM_PROVIDERS.map((p) => {
                  const state = providerState[p.id] ?? {
                    apiKey: null,
                    model: null,
                  };
                  const apiKeyValue = state.apiKey ?? data[p.apiKeyField] ?? "";
                  const modelValue =
                    state.model ?? data[p.modelField] ?? p.defaultModel;
                  const isConfigured = apiKeyValue.trim().length > 0;
                  const isActive = effectiveActiveProvider === p.id;
                  return (
                    <div
                      key={p.id}
                      className={`grid grid-cols-[1.6fr_2.4fr_1.8fr_auto] gap-3 items-center px-5 py-3.5 transition-colors ${isActive ? "bg-zinc-900/40" : "hover:bg-zinc-900/20"}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-md ${p.bg} border ${p.border} flex items-center justify-center flex-shrink-0`}
                        >
                          <Zap className={`w-3.5 h-3.5 ${p.color}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-zinc-200 truncate">
                            {p.name}
                          </p>
                          <p className="text-[10px] text-zinc-600 truncate">
                            {p.description}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <ApiKeyInput
                          value={apiKeyValue}
                          onChange={(v) =>
                            setProviderState((prev) => ({
                              ...prev,
                              [p.id]: { ...prev[p.id], apiKey: v },
                            }))
                          }
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
                          <span className="text-[10px] text-zinc-700 hidden sm:inline">
                            · {p.keyHint}
                          </span>
                        </div>
                      </div>
                      <div>
                        <TextInput
                          value={modelValue}
                          onChange={(v) =>
                            setProviderState((prev) => ({
                              ...prev,
                              [p.id]: { ...prev[p.id], model: v },
                            }))
                          }
                          placeholder={p.defaultModel}
                        />
                      </div>
                      <div className="flex justify-end pr-1">
                        <button
                          type="button"
                          onClick={() => setActiveProvider(p.id)}
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${isActive ? "border-zinc-200 bg-zinc-200" : "border-zinc-700 hover:border-zinc-500"}`}
                        >
                          {isActive && (
                            <div className="w-2 h-2 rounded-full bg-zinc-950" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="px-5 py-3 border-t border-zinc-900 bg-zinc-950/50 flex items-center gap-2">
                <span className="text-[11px] text-zinc-500">
                  Provider đang dùng:
                </span>
                <span className="text-[11px] font-bold text-zinc-200">
                  {LLM_PROVIDERS.find((p) => p.id === effectiveActiveProvider)
                    ?.name ?? effectiveActiveProvider}
                </span>
                {(
                  (providerState[effectiveActiveProvider]?.apiKey ??
                    data[
                      LLM_PROVIDERS.find(
                        (p) => p.id === effectiveActiveProvider,
                      )?.apiKeyField ?? ""
                    ]) ||
                  ""
                ).trim() ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-3 h-3" /> Key đã nhập
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-semibold">
                    ⚠ Chưa nhập API key cho provider này
                  </span>
                )}
              </div>
            </SectionCard>
          )}

          {/* ─── Tab: Media Sources ─── */}
          {activeTab === "media" && (
            <SectionCard
              icon={Image}
              title="Media Sources"
              description="API keys cho nguồn tư liệu hình ảnh, video"
            >
              <FieldRow
                label="Pexels API Keys"
                hint="Dùng nhiều key cách nhau bằng dấu phẩy"
              >
                <ApiKeyInput
                  value={getValue(pexelsApiKeys, "pexels_api_keys")}
                  onChange={setPexelsApiKeys}
                  placeholder="123adsf4567adf89, abd1321cd13..."
                />
              </FieldRow>
              <FieldRow
                label="Pixabay API Keys"
                hint="Dùng nhiều key cách nhau bằng dấu phẩy"
              >
                <ApiKeyInput
                  value={getValue(pixabayApiKeys, "pixabay_api_keys")}
                  onChange={setPixabayApiKeys}
                  placeholder="123adsf4567adf89, abd1321cd13..."
                />
              </FieldRow>
              <FieldRow
                label="Coverr API Keys"
                hint="Dùng nhiều key cách nhau bằng dấu phẩy"
              >
                <ApiKeyInput
                  value={getValue(coverrApiKeys, "coverr_api_keys")}
                  onChange={setCoverrApiKeys}
                  placeholder="123adsf4567adf89, abd1321cd13..."
                />
              </FieldRow>
              <FieldRow
                label="TwelveLabs API Keys"
                hint="Dùng nhiều key cách nhau bằng dấu phẩy"
              >
                <ApiKeyInput
                  value={getValue(twelvelabsApiKeys, "twelvelabs_api_keys")}
                  onChange={setTwelvelabsApiKeys}
                  placeholder="tlk_123adsf4567, tlk_abd1321..."
                />
              </FieldRow>
              <FieldRow
                label="TwelveLabs Re-rank"
                hint="Sắp xếp lại từ khóa tìm kiếm theo mức độ liên quan"
              >
                <Select
                  value={getValue(
                    twelvelabsRerank,
                    "twelvelabs_rerank_terms",
                    "false",
                  )}
                  onChange={setTwelvelabsRerank}
                  options={[
                    { value: "false", label: "Tắt" },
                    { value: "true", label: "Bật" },
                  ]}
                />
              </FieldRow>
            </SectionCard>
          )}

          {/* ─── Tab: TTS & Voice ─── */}
          {activeTab === "tts" && (
            <SectionCard
              icon={Mic}
              title="Text-to-Speech & Voice"
              description="Cấu hình giọng đọc và các provider TTS"
            >
              <FieldRow label="Giọng đọc mặc định" hint="Edge TTS (miễn phí)">
                <select
                  value={getValue(voice, "default_voice", "vi-VN-HoaiMyNeural")}
                  onChange={(e) => setVoice(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-600"
                >
                  <option value="vi-VN-HoaiMyNeural">
                    Hoài My (Nữ - Tiếng Việt)
                  </option>
                  <option value="vi-VN-NamMinhNeural">
                    Nam Minh (Nam - Tiếng Việt)
                  </option>
                  <option value="en-US-JennyNeural">
                    Jenny (Female - English)
                  </option>
                  <option value="en-US-GuyNeural">Guy (Male - English)</option>
                </select>
              </FieldRow>

              <div className="px-5 py-2 bg-zinc-900/30 border-b border-zinc-900/60">
                <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Azure Speech (TTS V2 - trả phí)
                </p>
              </div>
              <FieldRow label="Speech Key" hint="Azure Speech Services API Key">
                <ApiKeyInput
                  value={getValue(speechKey, "speech_key")}
                  onChange={setSpeechKey}
                  placeholder="your-azure-speech-key"
                />
              </FieldRow>
              <FieldRow label="Speech Region" hint="VD: eastus, southeastasia">
                <TextInput
                  value={getValue(speechRegion, "speech_region")}
                  onChange={setSpeechRegion}
                  placeholder="eastus"
                />
              </FieldRow>

              <div className="px-5 py-2 bg-zinc-900/30 border-b border-zinc-900/60">
                <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  ElevenLabs
                </p>
              </div>
              <FieldRow label="API Key" hint="elevenlabs.io">
                <ApiKeyInput
                  value={getValue(elevenlabsApiKey, "elevenlabs_api_key")}
                  onChange={setElevenlabsApiKey}
                  placeholder="ElevenLabs API Key"
                />
              </FieldRow>
              <FieldRow
                label="Model ID"
                hint="VD: eleven_multilingual_v2, eleven_flash_v2_5"
              >
                <TextInput
                  value={getValue(
                    elevenlabsModelId,
                    "elevenlabs_model_id",
                    "eleven_multilingual_v2",
                  )}
                  onChange={setElevenlabsModelId}
                  placeholder="eleven_multilingual_v2"
                />
              </FieldRow>

              <div className="px-5 py-2 bg-zinc-900/30 border-b border-zinc-900/60">
                <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  SiliconFlow
                </p>
              </div>
              <FieldRow label="API Key" hint="siliconflow.cn">
                <ApiKeyInput
                  value={getValue(siliconflowApiKey, "siliconflow_api_key")}
                  onChange={setSiliconflowApiKey}
                  placeholder="SiliconFlow API Key"
                />
              </FieldRow>

              <div className="px-5 py-2 bg-zinc-900/30 border-b border-zinc-900/60">
                <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Chatterbox (TTS tự host)
                </p>
              </div>
              <FieldRow label="Base URL" hint="OpenAI-compatible endpoint">
                <TextInput
                  value={getValue(
                    chatterboxBaseUrl,
                    "chatterbox_base_url",
                    "http://127.0.0.1:4123/v1",
                  )}
                  onChange={setChatterboxBaseUrl}
                  placeholder="http://127.0.0.1:4123/v1"
                />
              </FieldRow>
            </SectionCard>
          )}

          {/* ─── Tab: Video Defaults ─── */}
          {activeTab === "video" && (
            <SectionCard
              icon={Video}
              title="Video Defaults"
              description="Tham số mặc định khi tạo video"
            >
              <FieldRow label="Tỷ lệ khung hình">
                <select
                  value={getValue(ratio, "default_aspect_ratio", "9:16")}
                  onChange={(e) => setRatio(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-600"
                >
                  <option value="9:16">9:16 — Dọc (TikTok / Shorts)</option>
                  <option value="16:9">16:9 — Ngang (YouTube)</option>
                </select>
              </FieldRow>
              <FieldRow label="Nguồn tư liệu">
                <select
                  value={getValue(source, "default_video_source", "pexels")}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-600"
                >
                  <option value="pexels">Pexels API</option>
                  <option value="pixabay">Pixabay API</option>
                  <option value="local">Local (Thư mục cục bộ)</option>
                </select>
              </FieldRow>
              <FieldRow label="Subtitle Provider" hint="Công cụ tạo phụ đề">
                <select
                  value={getValue(
                    subtitleProvider,
                    "subtitle_provider",
                    "edge",
                  )}
                  onChange={(e) => setSubtitleProvider(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-600"
                >
                  <option value="edge">Edge TTS (nhanh, không cần GPU)</option>
                  <option value="whisper">
                    Whisper (chính xác hơn, cần GPU)
                  </option>
                  <option value="">Không tạo phụ đề</option>
                </select>
              </FieldRow>
              <FieldRow
                label="Edge TTS Timeout (s)"
                hint="Thời gian chờ tối đa cho mỗi request"
              >
                <TextInput
                  value={getValue(edgeTtsTimeout, "edge_tts_timeout", "30")}
                  onChange={setEdgeTtsTimeout}
                  placeholder="30"
                />
              </FieldRow>
            </SectionCard>
          )}

          {/* ─── Tab: Advanced ─── */}
          {activeTab === "advanced" && (
            <SectionCard
              icon={Cpu}
              title="Advanced"
              description="Cấu hình nâng cao"
            >
              <div className="px-5 py-2 bg-zinc-900/30 border-b border-zinc-900/60">
                <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Network & Security
                </p>
              </div>
              <FieldRow
                label="TLS Verify"
                hint="Kiểm tra chứng chỉ TLS khi gọi API & tải素材"
              >
                <select
                  value={getValue(tlsVerify, "tls_verify", "true")}
                  onChange={(e) => setTlsVerify(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-600"
                >
                  <option value="true">Bật (mặc định)</option>
                  <option value="false">
                    Tắt (chỉ khi dùng proxy doanh nghiệp)
                  </option>
                </select>
              </FieldRow>
              <FieldRow
                label="Enable Redis"
                hint="Dùng Redis để quản lý trạng thái task"
              >
                <select
                  value={getValue(enableRedis, "enable_redis", "false")}
                  onChange={(e) => setEnableRedis(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-600"
                >
                  <option value="false">Tắt</option>
                  <option value="true">Bật</option>
                </select>
              </FieldRow>

              <div className="px-5 py-2 bg-zinc-900/30 border-b border-zinc-900/60">
                <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Whisper (Subtitle)
                </p>
              </div>
              <FieldRow label="Model Size" hint="Dung lượng model Whisper">
                <select
                  value={getValue(
                    whisperModelSize,
                    "whisper_model_size",
                    "large-v3",
                  )}
                  onChange={(e) => setWhisperModelSize(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-600"
                >
                  <option value="large-v3">large-v3 (~3GB)</option>
                  <option value="large-v3-turbo">
                    large-v3-turbo (~250MB)
                  </option>
                  <option value="medium">medium</option>
                  <option value="small">small</option>
                  <option value="base">base</option>
                  <option value="tiny">tiny</option>
                </select>
              </FieldRow>
              <FieldRow label="Device" hint="CPU hoặc CUDA">
                <select
                  value={getValue(whisperDevice, "whisper_device", "CPU")}
                  onChange={(e) => setWhisperDevice(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-600"
                >
                  <option value="CPU">CPU</option>
                  <option value="cuda">CUDA (GPU)</option>
                </select>
              </FieldRow>
              <FieldRow label="Compute Type" hint="Độ chính xác tính toán">
                <select
                  value={getValue(
                    whisperComputeType,
                    "whisper_compute_type",
                    "int8",
                  )}
                  onChange={(e) => setWhisperComputeType(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-600"
                >
                  <option value="int8">int8 (mặc định)</option>
                  <option value="float16">float16</option>
                  <option value="float32">float32</option>
                </select>
              </FieldRow>
            </SectionCard>
          )}

          {/* ─── Storage Info ─── */}
          <SectionCard
            icon={Database}
            title="Lưu trữ Object Storage (MinIO)"
            description="Tích hợp tự động qua Docker Compose"
          >
            <div className="p-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Endpoint", value: "minio:9000" },
                  { label: "Bucket", value: "videos" },
                  { label: "Username", value: "minioadmin" },
                  { label: "Console", value: "localhost:9001" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="p-3 rounded-md bg-zinc-900 border border-zinc-800"
                  >
                    <p className="text-[10px] text-zinc-600 font-semibold uppercase tracking-wider">
                      {item.label}
                    </p>
                    <p className="text-xs text-zinc-300 font-mono mt-1">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-zinc-600 mt-3">
                MinIO được tích hợp tự động qua Docker Compose. Không cần cấu
                hình thêm.
              </p>
            </div>
          </SectionCard>

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
                <CheckCircle2 className="w-4 h-4" /> Đã lưu thành công!
              </span>
            )}
            {saveMutation.isError && (
              <div className="text-sm text-rose-400 font-semibold">
                Lưu thất bại: {saveError}
              </div>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
