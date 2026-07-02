"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Video,
  Play,
  Copy,
  Download,
  Trash2,
  RefreshCw,
  Film,
  Check,
  Loader2,
  Clock,
  ExternalLink,
} from "lucide-react";
import {
  backendVideoStreamUrl,
  backendVideoThumbnailUrl,
} from "@/lib/backend-media";

type VideoListItem = {
  id: string;
  title: string;
  ratio: string;
  createdAt: string;
  thumbnailObjectKey?: string | null;
};

type RegeneratedJob = {
  id?: string;
};

export default function Videos() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const {
    data: videos = [],
    isLoading,
    isError,
  } = useQuery<VideoListItem[]>({
    queryKey: ["videos"],
    queryFn: () => api.get("/videos").then((res) => res.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/videos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      setConfirmDeleteId(null);
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/videos/${id}/regenerate`).then((res) => res.data),
    onSuccess: (newJob: RegeneratedJob) => {
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      if (newJob?.id) {
        router.push(`/jobs/${newJob.id}`);
      } else {
        router.push("/jobs");
      }
    },
  });

  const handleCopyLink = (videoUrl: string, id: string) => {
    try {
      navigator.clipboard.writeText(videoUrl);
    } catch {
      // Clipboard not available
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Film className="w-5 h-5 text-zinc-400" />
          Thư viện Video
        </h2>
        <p className="text-xs text-zinc-500 mt-1">
          {videos.length} video đã tổng hợp thành công
        </p>
      </div>

      {isError ? (
        <div className="flex justify-center items-center py-20">
          <p className="text-sm text-rose-400">
            Không thể tải danh sách video. Vui lòng thử lại sau.
          </p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-7 h-7 text-zinc-600 animate-spin" />
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-20 text-zinc-600 text-sm border border-dashed border-zinc-900 rounded-lg">
          Chưa có video nào trong thư viện.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {videos.map((video) => {
            const thumbnailSrc = video.thumbnailObjectKey
              ? backendVideoThumbnailUrl(video.id)
              : undefined;
            const videoSrc = backendVideoStreamUrl(video.id);

            return (
              <div
                key={video.id}
                className="rounded-lg border border-zinc-900 bg-zinc-950 overflow-hidden hover:border-zinc-800 transition-all group flex flex-col"
              >
                {/* Thumbnail / Play → links to detail page */}
                <Link
                  href={`/videos/${video.id}`}
                  className="block relative aspect-[4/5] bg-zinc-900 overflow-hidden flex-shrink-0"
                >
                  {thumbnailSrc ? (
                    <Image
                      src={thumbnailSrc}
                      alt={video.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1280px) 33vw, 20vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video className="w-8 h-8 text-zinc-700" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="p-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                      <Play className="w-5 h-5 fill-white text-white ml-0.5" />
                    </div>
                  </div>
                  <span className="absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/70 text-zinc-300 font-mono">
                    {video.ratio}
                  </span>
                </Link>

                {/* Info */}
                <div className="p-3 flex-1 flex flex-col gap-2">
                  <Link href={`/videos/${video.id}`} className="block">
                    <h4 className="text-xs font-semibold text-zinc-200 group-hover:text-white line-clamp-2 leading-snug transition-colors">
                      {video.title}
                    </h4>
                    <p className="text-[10px] text-zinc-600 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(video.createdAt).toLocaleDateString("vi-VN")}
                    </p>
                  </Link>

                  {/* Actions */}
                  {confirmDeleteId === video.id ? (
                    <div className="flex gap-1.5 mt-auto">
                      <button
                        onClick={() => deleteMutation.mutate(video.id)}
                        disabled={deleteMutation.isPending}
                        className="flex-1 py-1.5 rounded-md bg-rose-950/40 border border-rose-900/50 text-rose-400 text-[10px] font-bold hover:bg-rose-950/60 transition-all disabled:opacity-50"
                      >
                        {deleteMutation.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin mx-auto" />
                        ) : (
                          "Xác nhận xóa"
                        )}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2.5 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 text-[10px] font-bold hover:text-white transition-all"
                      >
                        Hủy
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 mt-auto pt-2 border-t border-zinc-900">
                      <button
                        onClick={() => handleCopyLink(videoSrc, video.id)}
                        className="p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700 transition-all"
                        title="Sao chép liên kết"
                      >
                        {copiedId === video.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <a
                        href={videoSrc}
                        download={`video-${video.id}.mp4`}
                        className="p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700 transition-all flex items-center justify-center"
                        title="Tải xuống"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => regenerateMutation.mutate(video.id)}
                        disabled={regenerateMutation.isPending}
                        className="p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700 transition-all disabled:opacity-50"
                        title="Render lại"
                      >
                        {regenerateMutation.isPending &&
                        regenerateMutation.variables === video.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <Link
                        href={`/videos/${video.id}`}
                        className="p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700 transition-all flex items-center justify-center"
                        title="Xem chi tiết"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        onClick={() => setConfirmDeleteId(video.id)}
                        className="ml-auto p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-600 hover:text-rose-400 hover:border-rose-900/50 transition-all"
                        title="Xóa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
