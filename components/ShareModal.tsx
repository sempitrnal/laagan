"use client";
import { useState } from "react";
import { X, Copy, Check, Globe, Smartphone } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tripCode: string;
  tripName: string;
}

export default function ShareModal({
  isOpen,
  onClose,
  tripCode,
  tripName,
}: Props) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const tripUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/trip/${tripCode}`
      : `/trip/${tripCode}`;

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(tripCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(tripUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 modal-backdrop animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl animate-slide-up overflow-hidden">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 bg-linear-to-br from-ocean-dark to-ocean text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3 mb-1">
            <Globe className="w-5 h-5 opacity-80" />
            <span className="text-sm font-medium opacity-80 uppercase tracking-wider">
              Trip Invite
            </span>
          </div>
          <h2 className="font-display text-2xl font-semibold">{tripName}</h2>
          <p className="text-sm opacity-75 mt-0.5">
            Share this with your travel crew
          </p>
        </div>

        <div className="p-6 space-y-5">
          {/* Passport stamp code */}
          <div className="flex justify-center">
            <div className="passport-stamp rounded-xl px-8 py-5 text-center">
              <p className="text-xs text-ocean font-semibold uppercase tracking-widest mb-1">
                Trip Code
              </p>
              <p className="text-3xl sm:text-4xl font-bold tracking-[0.3em] text-ocean-dark font-mono">
                {tripCode}
              </p>
              <p className="text-xs text-muted mt-1">
                Enter at Wandersplit to join
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleCopyCode}
              className="btn-press w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 border-warmgray hover:border-ocean transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-sand flex items-center justify-center group-hover:bg-ocean/10 transition-colors">
                  <Smartphone className="w-4 h-4 text-ocean" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-night">
                    Copy trip code
                  </p>
                  <p className="text-xs text-muted">
                    Friends enter this at wandersplit.app
                  </p>
                </div>
              </div>
              {copied ? (
                <Check className="w-4 h-4 text-forest shrink-0" />
              ) : (
                <Copy className="w-4 h-4 text-muted shrink-0" />
              )}
            </button>

            <button
              onClick={handleCopyLink}
              className="btn-press w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 border-warmgray hover:border-ocean transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-sand flex items-center justify-center group-hover:bg-ocean/10 transition-colors">
                  <Globe className="w-4 h-4 text-ocean" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-night">
                    Copy invite link
                  </p>
                  <p className="text-xs text-muted truncate max-w-[200px]">
                    {tripUrl}
                  </p>
                </div>
              </div>
              {copied ? (
                <Check className="w-4 h-4 text-forest shrink-0" />
              ) : (
                <Copy className="w-4 h-4 text-muted shrink-0" />
              )}
            </button>
          </div>

          {/* Info */}
          <p className="text-xs text-center text-muted px-4">
            Anyone with the code or link can join and add expenses to this trip.
          </p>
        </div>
      </div>
    </div>
  );
}
