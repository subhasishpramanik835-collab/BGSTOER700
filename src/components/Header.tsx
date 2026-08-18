import React, { useState, useEffect, useRef } from 'react';
import { Wallet, Plus, Bell, Volume2, VolumeX, User as UserIcon, Crown, Gift, AlertTriangle } from 'lucide-react';
import { User } from '../types';
import { soundFx } from '../utils/audio';

interface HeaderProps {
  balance: number;
  unreadNotificationsCount: number;
  onOpenDeposit: () => void;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  muted: boolean;
  onToggleMute: () => void;
  user?: User;
}

export const Header: React.FC<HeaderProps> = ({
  balance,
  unreadNotificationsCount,
  onOpenDeposit,
  onOpenNotifications,
  onOpenProfile,
  muted,
  onToggleMute,
  user
}) => {
  const [isFlashingGreen, setIsFlashingGreen] = useState(false);
  const prevBalanceRef = useRef(balance);

  // Trigger subtle green flashing animation whenever balance increases
  useEffect(() => {
    if (balance > prevBalanceRef.current) {
      setIsFlashingGreen(true);
      const timer = setTimeout(() => setIsFlashingGreen(false), 2000);
      return () => clearTimeout(timer);
    }
    prevBalanceRef.current = balance;
  }, [balance]);

  const bonusBalance = user?.bonusBalance || 0;

  return (
    <header className="sticky top-0 z-40 w-full bg-slate-950/95 backdrop-blur-md border-b border-amber-500/30 shadow-2xl shadow-black/80 transition-all">
      {/* 100% Width Layout Container */}
      <div className="w-full px-3 sm:px-6 h-16 flex items-center justify-between gap-2">
        
        {/* Left Side: B ETGURU Vibrating Logo + User Quick Profile */}
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          {/* Animated Vibrating Logo Badge with "B" */}
          <div 
            onClick={onOpenProfile}
            className="flex items-center gap-2 cursor-pointer group hover:opacity-95 transition-all"
            title="B ETGURU HD Lottery & Casino"
          >
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 p-0.5 shadow-lg shadow-amber-500/30 group-hover:scale-105 transition-transform animate-vibrate">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center relative overflow-hidden">
                <span className="font-black text-xl sm:text-2xl text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-amber-400 to-amber-500 font-mono leading-none drop-shadow">
                  B
                </span>
                <div className="absolute inset-0 bg-amber-400/20 blur-xs"></div>
              </div>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-lg sm:text-xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 drop-shadow-sm font-mono leading-none">
                  ETGURU
                </span>
                <span className="bg-amber-500/20 text-amber-400 text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded border border-amber-500/30 uppercase tracking-widest hidden xs:inline-block font-mono">
                  HD
                </span>
              </div>
              <span className="text-[9px] text-emerald-400 font-bold tracking-tight -mt-0.5 flex items-center gap-1 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                ONLINE
              </span>
            </div>
          </div>

          {/* User Quick Avatar Badge */}
          {user && (
            <div 
              onClick={onOpenProfile} 
              className="hidden md:flex items-center gap-2 cursor-pointer p-1.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/40 transition-all"
              title="Open User Profile"
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name || 'Profile'}
                  className="w-7 h-7 rounded-lg object-cover border border-amber-400/40"
                />
              ) : (
                <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-amber-400">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
              <div className="flex flex-col text-left">
                <span className="font-bold text-xs text-slate-200 font-mono leading-tight truncate max-w-[100px]">
                  {user.name}
                </span>
                <span className="text-[9px] text-amber-400 font-mono font-semibold flex items-center gap-0.5">
                  <Crown className="w-2.5 h-2.5" />
                  {user.vipLevel || 'Gold'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Wallet Balance + Plus Deposit + Bell */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* Low Balance Warning Notification Banner when balance drops below ₹50 */}
          {balance < 50 && (
            <div
              onClick={() => { soundFx.playClick(); onOpenDeposit(); }}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 bg-amber-500/20 border border-amber-500/60 hover:border-amber-400 rounded-xl text-amber-300 hover:text-amber-200 text-[10px] sm:text-xs font-mono font-bold animate-pulse cursor-pointer shrink-0 transition-all shadow-lg shadow-amber-500/10"
              title="Wallet balance is below ₹50 threshold! Tap to deposit & keep playing"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-bounce" />
              <span className="hidden sm:inline">LOW BAL (&lt; ₹50)</span>
              <span className="sm:hidden text-[9px] font-black">LOW BAL</span>
            </div>
          )}

          {/* Integrated Wallet Badge (Balance + Plus Deposit Button) */}
          <div 
            onClick={onOpenDeposit}
            className={`flex items-center bg-slate-900/90 border rounded-2xl p-1 sm:p-1.5 cursor-pointer shadow-lg transition-all group ${
              isFlashingGreen
                ? 'border-emerald-400 bg-emerald-950/40 shadow-emerald-500/50 ring-2 ring-emerald-400/60 animate-pulse'
                : 'border-amber-500/40 hover:border-amber-400'
            }`}
          >
            <div className="flex items-center gap-2 px-2 py-0.5">
              <div className={`w-6 h-6 rounded-xl flex items-center justify-center transition-colors ${
                isFlashingGreen 
                  ? 'bg-emerald-500 text-slate-950 font-bold animate-bounce' 
                  : 'bg-amber-500/20 border border-amber-500/30 text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950'
              }`}>
                <Wallet className="w-3.5 h-3.5" />
              </div>

              <div className="flex flex-col text-left">
                <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold leading-none">WALLET</span>
                <span className={`text-xs sm:text-sm font-black font-mono tracking-tight leading-tight transition-colors ${
                  isFlashingGreen ? 'text-emerald-300 scale-105' : 'text-amber-300'
                }`}>
                  ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Prominent Plus Deposit Button with Blinking Animation */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                soundFx.playClick();
                onOpenDeposit();
              }}
              className="ml-1 px-2.5 py-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs rounded-xl golden-shadow-btn flex items-center gap-1 transition-all active:scale-95 shrink-0 relative overflow-hidden"
              title="Add Money / Deposit"
            >
              <div className="relative flex items-center justify-center">
                <Plus className="w-3.5 h-3.5 stroke-[3] animate-pulse" />
                <span className="absolute -inset-1 rounded-full bg-emerald-400/50 animate-ping pointer-events-none"></span>
              </div>
              <span className="hidden xs:inline font-mono font-black">DEPOSIT</span>
            </button>
          </div>

          {/* Combined Notification Bell Widget with Sound Speaker Toggle Inside */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-2xl p-1 gap-1 shadow-md">
            {/* Embedded Sound Toggle Icon */}
            <button
              onClick={() => {
                onToggleMute();
              }}
              className={`p-1.5 rounded-xl transition-all active:scale-90 ${
                muted 
                  ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800' 
                  : 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
              }`}
              title={muted ? "Unmute Sound FX" : "Mute Sound FX"}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-amber-400 animate-pulse" />}
            </button>

            {/* Vertical Divider */}
            <div className="w-[1px] h-4 bg-slate-800"></div>

            {/* Notifications Bell */}
            <button
              onClick={() => { soundFx.playClick(); onOpenNotifications(); }}
              className="relative p-1.5 rounded-xl text-slate-300 hover:text-amber-400 hover:bg-slate-800 transition-all active:scale-90 golden-shadow-btn"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center animate-bounce shadow-md">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};


