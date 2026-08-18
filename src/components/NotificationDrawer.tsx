import React from 'react';
import { X, Bell, CheckCircle2, XCircle, Trophy, Megaphone, Check, Trash2, Clock } from 'lucide-react';
import { NotificationItem } from '../types';
import { soundFx } from '../utils/audio';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
  onClearAll: () => void;
  onRemoveNotification?: (id: string) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead,
  onClearAll,
  onRemoveNotification
}) => {
  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.read).length;

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'win':
        return <Trophy className="w-5 h-5 text-amber-400" />;
      case 'deposit':
      case 'withdrawal':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case 'loss':
        return <XCircle className="w-5 h-5 text-rose-400" />;
      case 'system':
      default:
        return <Megaphone className="w-5 h-5 text-cyan-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-950 border-l border-amber-500/20 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-4 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Bell className="w-5 h-5 text-amber-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping"></span>
              )}
            </div>
            <h2 className="text-base font-extrabold text-white font-mono">Notifications</h2>
            {unreadCount > 0 && (
              <span className="bg-amber-500/20 text-amber-300 text-xs font-bold px-2 py-0.5 rounded-full border border-amber-500/30 font-mono">
                {unreadCount} New
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <button
                onClick={() => { soundFx.playClick(); onMarkAllRead(); }}
                className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 transition-colors"
                title="Mark all as read"
              >
                <Check className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Read</span>
              </button>
            )}

            {notifications.length > 0 && (
              <button
                onClick={() => { soundFx.playClick(); onClearAll(); }}
                className="text-xs text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20 transition-colors"
                title="Clear all notifications"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Info Banner on Auto Dismissal */}
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-[11px] text-amber-300 font-mono flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 shrink-0 text-amber-400 animate-pulse" />
          <span>Informational alerts auto-dismiss in 5s to keep clean.</span>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notifications.length === 0 ? (
            <div className="text-center py-16 text-slate-400 space-y-2">
              <Bell className="w-10 h-10 text-slate-400 mx-auto opacity-40" />
              <p className="text-sm font-medium">No notifications yet</p>
            </div>
          ) : (
            notifications.map((ntf) => (
              <div
                key={ntf.id}
                className={`p-4 rounded-2xl border transition-all relative group ${
                  ntf.read
                    ? 'bg-slate-900/60 border-slate-800/80 text-slate-400'
                    : 'bg-gradient-to-r from-slate-900 to-amber-950/20 border-amber-500/30 text-white shadow-lg'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 shrink-0">
                    {getIcon(ntf.type)}
                  </div>
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className="text-xs font-extrabold text-white truncate font-mono">{ntf.title}</h4>
                      <span className="text-[10px] text-slate-400 shrink-0">{ntf.date}</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{ntf.message}</p>

                    {ntf.type === 'system' && !ntf.isCritical && (
                      <span className="inline-block mt-1.5 text-[9px] font-mono text-cyan-400/80 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/40">
                        ⚡ Auto-Dismissing Info
                      </span>
                    )}
                  </div>

                  {/* Delete individual notification button */}
                  {onRemoveNotification && (
                    <button
                      onClick={() => onRemoveNotification(ntf.id)}
                      className="absolute top-3 right-3 p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                      title="Dismiss notification"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
};

