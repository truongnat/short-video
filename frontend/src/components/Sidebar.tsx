"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Lightbulb,
  PlayCircle,
  Video,
  Settings,
  Terminal,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem("sidebar-collapsed");
      return saved === "true";
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar-collapsed", String(next));
      } catch {
        // localStorage not available
      }
      return next;
    });
  };

  const menuItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Ý tưởng (Ideas)", href: "/ideas", icon: Lightbulb },
    { name: "Hàng đợi (Jobs)", href: "/jobs", icon: PlayCircle },
    { name: "Thư viện Video", href: "/videos", icon: Video },
    { name: "Cấu hình (Settings)", href: "/settings", icon: Settings },
  ];

  return (
    <aside
      className={`border-r border-zinc-900 bg-zinc-950/80 backdrop-blur-md flex flex-col h-screen sticky top-0 transition-all duration-300 ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Brand Header */}
      <div
        className={`p-4 border-b border-zinc-900 flex items-center h-16 ${
          isCollapsed ? "justify-center" : "gap-3 px-6"
        }`}
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/10 relative group flex-shrink-0">
          <div className="absolute inset-0 rounded-lg bg-violet-600 blur-sm opacity-50 group-hover:opacity-75 transition-opacity" />
          <Terminal
            className="w-5 h-5 text-white relative z-10"
            aria-hidden="true"
          />
        </div>
        {!isCollapsed && (
          <div className="min-w-0">
            <h1 className="font-bold text-sm bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 leading-none tracking-tight truncate">
              Turbo Video
            </h1>
            <span className="text-[9px] text-zinc-500 font-semibold tracking-wider uppercase">
              Engine SaaS v1.0
            </span>
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav className={`flex-1 py-6 space-y-1 ${isCollapsed ? "px-2" : "px-4"}`}>
        {menuItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={isCollapsed ? item.name : undefined}
              className={`flex items-center rounded-md transition-all duration-200 group relative ${
                isCollapsed
                  ? "justify-center w-10 h-10 mx-auto"
                  : "gap-3 px-4 py-2.5"
              } ${
                isActive
                  ? "bg-zinc-100 text-zinc-950 font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
              }`}
            >
              <item.icon
                className={`w-4 h-4 flex-shrink-0 ${
                  isActive
                    ? "text-zinc-950"
                    : "text-zinc-500 group-hover:text-zinc-300"
                }`}
                aria-hidden="true"
              />
              {!isCollapsed && <span className="text-xs">{item.name}</span>}
              {isActive && !isCollapsed && (
                <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-zinc-950 animate-pulse" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Toggle Button */}
      <div
        className={`p-3 border-t border-zinc-900 ${isCollapsed ? "px-2" : "px-4"}`}
      >
        <button
          onClick={toggleCollapse}
          className={`flex items-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40 rounded-md transition-all w-full py-2 ${
            isCollapsed ? "justify-center" : "px-4 gap-3"
          }`}
          title={isCollapsed ? "Mở rộng menu" : "Thu gọn menu"}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-semibold">Thu gọn menu</span>
            </>
          )}
        </button>
      </div>

      {/* Footer Info */}
      {!isCollapsed && (
        <div className="p-3 border-t border-zinc-900 bg-zinc-950/20 text-center">
          <p className="text-[10px] text-zinc-600 font-medium">
            Powered by MoneyPrinterTurbo
          </p>
        </div>
      )}
    </aside>
  );
}
