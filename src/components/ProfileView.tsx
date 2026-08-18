import React, { useState } from 'react';
import { User as UserIcon, Wallet, Copy, Check, Share2, Plus, ArrowUpRight, ArrowDownLeft, Ticket, Trophy, XCircle, ShieldCheck, Clock, LogOut, Crown, Award, Sparkles, ChevronRight, Zap, Shield, Gift, Settings, Volume2, VolumeX, Music, Vibrate, Sliders } from 'lucide-react';
import { User, DepositRequest, WithdrawalRequest, PurchasedTicket, WalletTransaction, UserSettings } from '../types';
import { soundFx } from '../utils/audio';
import { WalletLedger } from './WalletLedger';
import { VIP_TIERS, getNextTierInfo, calculateVipLevel } from '../utils/vip';
import confetti from 'canvas-confetti';
import { VoucherGenerator } from './VoucherGenerator';
import { sortChronologicalNewestFirst } from '../utils/supercar';

interface ProfileViewProps {
  user: User;
  deposits: DepositRequest[];
  withdrawals: WithdrawalRequest[];
  tickets: PurchasedTicket[];
  transactions: WalletTransaction[];
  onOpenDeposit: () => void;
  onOpenWithdraw: () => void;
  onLogout?: () => void;
  onClaimVipBonus?: (bonusAmount: number) => void;
  onOpenAdmin?: () => void;
  onUpdateSettings?: (newSettings: UserSettings) => void;
  onOpenSettings?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  deposits,
  withdrawals,
  tickets,
  transactions,
  onOpenDeposit,
  onOpenWithdraw,
  onLogout,
  onClaimVipBonus,
  onOpenAdmin,
  onUpdateSettings,
  onOpenSettings
}) => {
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [copiedRef, setCopiedRef] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'deposits' | 'withdrawals' | 'tickets' | 'casino' | 'bonuses' | 'ledger'>('ledger');
  const [ticketFilter, setTicketFilter] = useState<'all' | 'win' | 'loss'>('all');
  const [casinoSubFilter, setCasinoSubFilter] = useState<'all' | 'roulette' | 'dragon_tiger' | 'andar_bahar'>('all');
  const [hasClaimedWeeklyBonus, setHasClaimedWeeklyBonus] = useState<boolean>(false);
  const [showPhotoModal, setShowPhotoModal] = useState<boolean>(false);
  const [selectedVoucherTx, setSelectedVoucherTx] = useState<any>(null);
  const [showVipModal, setShowVipModal] = useState<boolean>(false);
  const [showBonusInfoModal, setShowBonusInfoModal] = useState<boolean>(false);

  const [settings, setSettings] = useState<UserSettings>({
    bgMusicEnabled: user.settings?.bgMusicEnabled ?? true,
    soundEffectsEnabled: user.settings?.soundEffectsEnabled ?? true,
    hapticEnabled: user.settings?.hapticEnabled ?? true
  });

  const handleToggleSetting = (key: keyof UserSettings) => {
    const updated: UserSettings = {
      ...settings,
      [key]: !(settings[key] ?? true)
    };
    setSettings(updated);

    if (key === 'bgMusicEnabled') soundFx.setBgMusicEnabled(updated.bgMusicEnabled ?? true);
    if (key === 'soundEffectsEnabled') soundFx.setSoundEffectsEnabled(updated.soundEffectsEnabled ?? true);
    if (key === 'hapticEnabled') soundFx.setHapticEnabled(updated.hapticEnabled ?? true);

    soundFx.playClick();

    if (onUpdateSettings) {
      onUpdateSettings(updated);
    }
  };

  const sortedDeposits = sortChronologicalNewestFirst(deposits);
  const sortedWithdrawals = sortChronologicalNewestFirst(withdrawals);
  const sortedTransactions = sortChronologicalNewestFirst(transactions);

  const casinoTx = sortChronologicalNewestFirst(
    sortedTransactions.filter(
      (t) =>
        t.type === 'roulette_bet' ||
        t.type === 'roulette_win' ||
        t.type === 'dragon_tiger_bet' ||
        t.type === 'dragon_tiger_win' ||
        t.type === 'andar_bahar_bet' ||
        t.type === 'andar_bahar_win' ||
        t.description.toLowerCase().includes('roulette') ||
        t.description.toLowerCase().includes('dragon tiger') ||
        t.description.toLowerCase().includes('andar bahar')
    )
  );

  const filteredCasinoTx = casinoTx.filter((t) => {
    if (casinoSubFilter === 'roulette') {
      return t.type === 'roulette_bet' || t.type === 'roulette_win' || t.description.toLowerCase().includes('roulette');
    }
    if (casinoSubFilter === 'dragon_tiger') {
      return t.type === 'dragon_tiger_bet' || t.type === 'dragon_tiger_win' || t.description.toLowerCase().includes('dragon tiger');
    }
    if (casinoSubFilter === 'andar_bahar') {
      return t.type === 'andar_bahar_bet' || t.type === 'andar_bahar_win' || t.description.toLowerCase().includes('andar bahar');
    }
    return true;
  });

  const bonusTx = sortChronologicalNewestFirst(
    sortedTransactions.filter(
      (t) =>
        t.type === 'wheel_bonus' ||
        t.type === 'admin_bonus' ||
        t.type === 'vip_bonus' ||
        t.type === 'admin_deduction' ||
        t.description.toLowerCase().includes('bonus') ||
        t.description.toLowerCase().includes('reward') ||
        t.description.toLowerCase().includes('voucher') ||
        t.description.toLowerCase().includes('cashback')
    )
  );

  const isAdminUser = user.email?.toLowerCase() === 'asishp92@gmail.com' || user.role === 'admin';
  const vipPts = user.vipPoints || (user.totalSpent ? Math.floor(user.totalSpent / 10) : 120);
  const currentLevel = calculateVipLevel(vipPts);
  const currentTierInfo = VIP_TIERS[currentLevel];
  const { nextTier, pointsNeeded, progressPercent } = getNextTierInfo(vipPts);

  const handleCopyId = () => {
    navigator.clipboard.writeText(user.id);
    setCopiedId(true);
    soundFx.playClick();
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyReferral = () => {
    const link = `https://betguru.com/signup?ref=${user.referralCode}`;
    navigator.clipboard.writeText(link);
    setCopiedRef(true);
    soundFx.playClick();
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const handleClaimBonus = () => {
    if (hasClaimedWeeklyBonus) return;
    if (currentTierInfo.weeklyBonusAmount <= 0) {
      alert('Advance to Silver tier or higher to unlock weekly VIP bonus payouts!');
      return;
    }

    soundFx.playWinFanfare();
    confetti({ particleCount: 80, spread: 80, origin: { y: 0.6 } });
    setHasClaimedWeeklyBonus(true);

    if (onClaimVipBonus) {
      onClaimVipBonus(currentTierInfo.weeklyBonusAmount);
    }
  };

  const filteredTickets = sortChronologicalNewestFirst(
    tickets.filter(t => {
      if (ticketFilter === 'all') return true;
      return t.status === ticketFilter;
    })
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 pb-24">
      
      {/* Top Profile Hero Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/40 border border-amber-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        
        {/* VIP Badge fixed in Top Right Corner */}
        <div className="absolute top-3 right-3 sm:top-4 sm:right-5 z-20 flex items-center gap-1.5">
          <button
            onClick={() => { soundFx.playClick(); setShowVipModal(true); }}
            className={`px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-2xl flex items-center gap-1.5 font-mono text-xs font-black shadow-xl border backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer ${currentTierInfo.badgeBg}`}
            title="Tap to view VIP Club & Loyalty Rewards"
          >
            <Crown className="w-4 h-4 text-amber-300 animate-pulse" />
            <span className="uppercase tracking-wider font-extrabold">{currentLevel} VIP</span>
          </button>
        </div>

        {/* Ambient Gold Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10 pt-2 sm:pt-0">
          
          {/* Avatar & User Details */}
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <div 
              onClick={() => {
                soundFx.playClick();
                setShowPhotoModal(true);
              }}
              className="relative group cursor-pointer"
              title="Click to view profile photo"
            >
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl object-cover border-2 border-amber-400 shadow-xl shadow-amber-500/20 group-hover:scale-105 group-hover:border-amber-300 transition-all duration-300"
              />
              <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-amber-300 font-extrabold text-[10px] font-mono">
                VIEW PHOTO
              </div>
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-md border bg-slate-900 text-amber-400 border-amber-500/40">
                PROFILE
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-white font-mono">{user.name}</h2>
                <button
                  onClick={() => { soundFx.playClick(); setShowVipModal(true); }}
                  className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1 font-mono cursor-pointer transition-all hover:scale-105"
                  title="Tap to view VIP Club"
                >
                  <Award className="w-3 h-3 text-amber-400" />
                  <span>{vipPts.toLocaleString()} VIP PTS</span>
                </button>
                {isAdminUser && (
                  <span className="bg-rose-500/20 text-rose-400 text-[10px] font-black px-2 py-0.5 rounded-full border border-rose-500/40 flex items-center gap-1 font-mono uppercase">
                    <Shield className="w-3 h-3" />
                    <span>ADMIN</span>
                  </span>
                )}
              </div>

              <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-mono">
                <span className="text-slate-400">ID: {user.id}</span>
                <button
                  onClick={handleCopyId}
                  className="p-1 text-amber-400 hover:text-amber-300 font-bold text-[11px] flex items-center gap-1"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 text-xs text-slate-400 font-mono">
                <span>📧 {user.email}</span>
                <span>📞 {user.phone}</span>
                <span>📅 Member Since: {user.regDate}</span>
              </div>
            </div>
          </div>

          {/* Wallet Balance & Action Buttons */}
          <div className="flex flex-col items-center md:items-end gap-3 w-full md:w-auto max-w-full bg-slate-950/80 p-3.5 sm:p-4 rounded-2xl border border-slate-800 overflow-hidden">
            {/* Vertical Stacked Wallet Balance (Main UP, Bonus DOWN) */}
            <div className="flex flex-col gap-2.5 w-full text-center md:text-right max-w-full overflow-hidden">
              {/* Main Wallet (UP) */}
              <div className="bg-slate-900/90 p-3 rounded-xl border border-amber-500/30 flex items-center justify-between gap-3 w-full min-w-0 overflow-hidden">
                <span className="text-[10px] sm:text-xs text-amber-400 font-mono font-extrabold uppercase tracking-wider flex items-center gap-1 shrink-0">
                  <Wallet className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>MAIN WALLET</span>
                </span>
                <span className={`font-black text-amber-300 font-mono tracking-tight shrink min-w-0 text-right truncate ${
                  `₹${user.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`.length > 16 
                    ? 'text-xs sm:text-sm' 
                    : `₹${user.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`.length > 12 
                    ? 'text-sm sm:text-base' 
                    : 'text-base sm:text-xl md:text-2xl'
                }`}>
                  ₹{user.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Bonus Wallet (DOWN) - Interactive Tap */}
              <div 
                onClick={() => { soundFx.playClick(); setShowBonusInfoModal(true); }}
                className="bg-slate-900/90 hover:bg-slate-800/90 p-3 rounded-xl border border-purple-500/30 hover:border-purple-400 flex items-center justify-between gap-3 w-full min-w-0 overflow-hidden cursor-pointer group transition-all"
                title="Tap to see Bonus Balance Rules & Super Car Ticket Pricing"
              >
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] sm:text-xs text-purple-300 font-mono font-extrabold uppercase tracking-wider flex items-center gap-1">
                    <Gift className="w-3.5 h-3.5 text-purple-400 group-hover:animate-bounce shrink-0" />
                    <span>BONUS WALLET</span>
                  </span>
                  <span className="text-[8px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-1 rounded font-mono font-bold">
                    TAP INFO
                  </span>
                </div>
                <span className={`font-black text-purple-300 font-mono tracking-tight shrink min-w-0 text-right truncate group-hover:scale-105 transition-transform ${
                  `₹${(user.bonusBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`.length > 16 
                    ? 'text-xs sm:text-sm' 
                    : `₹${(user.bonusBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`.length > 12 
                    ? 'text-sm sm:text-base' 
                    : 'text-base sm:text-xl md:text-2xl'
                }`}>
                  ₹{(user.bonusBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => { soundFx.playClick(); onOpenDeposit(); }}
                className="flex-1 sm:flex-initial px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 hover:from-emerald-400 transition-all flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>DEPOSIT</span>
              </button>

              <button
                onClick={() => { soundFx.playClick(); onOpenWithdraw(); }}
                className="flex-1 sm:flex-initial px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-black text-xs rounded-xl border border-amber-500/30 transition-all flex items-center justify-center gap-1.5"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>WITHDRAW</span>
              </button>

              <button
                onClick={() => {
                  soundFx.playClick();
                  if (onOpenSettings) {
                    onOpenSettings();
                  }
                }}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-xl border border-amber-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                title="App Settings & Preferences"
              >
                <Settings className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">SETTINGS</span>
              </button>

              {isAdminUser && onOpenAdmin && (
                <button
                  onClick={() => { soundFx.playClick(); onOpenAdmin(); }}
                  className="flex-1 sm:flex-initial px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5"
                  title="Open Admin Dashboard"
                >
                  <Shield className="w-4 h-4" />
                  <span>ADMIN PANEL</span>
                </button>
              )}

              {onLogout && (
                <button
                  onClick={() => { soundFx.playClick(); onLogout(); }}
                  className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-xs rounded-xl border border-rose-500/30 transition-all flex items-center justify-center gap-1.5"
                  title="Sign Out of Account"
                >
                  <LogOut className="w-4 h-4 text-rose-400" />
                  <span className="hidden sm:inline">LOGOUT</span>
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Referral Box */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Share2 className="w-4 h-4 text-amber-400" />
            <span>Referral Code: <strong className="font-mono text-amber-400">{user.referralCode}</strong> (Earn ₹100 per friend)</span>
          </div>

          <button
            onClick={handleCopyReferral}
            className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-xs rounded-xl hover:bg-amber-500/20 transition-all flex items-center gap-1.5"
          >
            {copiedRef ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedRef ? 'Referral Link Copied!' : 'Copy Referral Link'}</span>
          </button>
        </div>

      </div>

      {/* History Tabs Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-2 gap-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'deposits', label: 'Deposit History', count: sortedDeposits.length },
            { id: 'withdrawals', label: 'Withdrawal History', count: sortedWithdrawals.length },
            { id: 'casino', label: 'Casino & Live Bets', count: casinoTx.length },
            { id: 'tickets', label: 'Ticket History', count: tickets.length },
            { id: 'bonuses', label: 'Vouchers & Bonuses', count: bonusTx.length },
            { id: 'ledger', label: 'Wallet Ledger', count: sortedTransactions.length }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => { soundFx.playClick(); setActiveTab(tab.id as typeof activeTab); }}
              className={`px-4 py-2 rounded-2xl text-xs font-mono font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === tab.id ? 'bg-slate-950 text-amber-300' : 'bg-slate-800 text-slate-300'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Sub-filter if ticket history is selected */}
        {activeTab === 'tickets' && (
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
            {(['all', 'win', 'loss'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTicketFilter(tf)}
                className={`px-2.5 py-1 text-[11px] font-mono font-bold capitalize rounded-lg transition-all ${
                  ticketFilter === tf ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        )}

        {/* Sub-filter if casino & live games tab is selected */}
        {activeTab === 'casino' && (
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto shrink-0">
            {[
              { id: 'all', label: 'All Casino' },
              { id: 'roulette', label: 'Roulette' },
              { id: 'dragon_tiger', label: 'Dragon Tiger' },
              { id: 'andar_bahar', label: 'Andar Bahar' }
            ].map((cf) => (
              <button
                key={cf.id}
                onClick={() => { soundFx.playClick(); setCasinoSubFilter(cf.id as typeof casinoSubFilter); }}
                className={`px-2.5 py-1 text-[11px] font-mono font-bold whitespace-nowrap rounded-lg transition-all ${
                  casinoSubFilter === cf.id ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                {cf.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* History Content Panels */}
      <div className="space-y-3">
        
        {/* TICKET HISTORY */}
        {activeTab === 'tickets' && (
          filteredTickets.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-slate-900/60 rounded-2xl border border-slate-800">
              No tickets under {ticketFilter} filter.
            </div>
          ) : (
            filteredTickets.map((t) => {
              const isWin = t.status === 'win';
              const isLoss = t.status === 'loss';

              return (
                <div 
                  key={t.id} 
                  className={`p-4 bg-slate-900/90 border rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all hover:border-amber-500/50 cursor-pointer ${
                    isWin 
                      ? 'border-emerald-500/40 bg-emerald-950/10' 
                      : isLoss 
                      ? 'border-rose-500/40 bg-rose-950/10' 
                      : 'border-slate-800'
                  }`}
                  onClick={() => { soundFx.playClick(); setSelectedVoucherTx(t); }}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-amber-400">{t.id}</span>
                      <span className="text-xs text-slate-400">• {t.purchaseDate}</span>
                    </div>
                    <h4 className="text-sm font-extrabold text-white font-mono">{t.drawTitle}</h4>
                    <p className="text-xs font-mono text-slate-300">
                      Ticket Digits: <strong className="text-amber-300">{(t.selectedNumbers || (t as any).numbers || []).join(' ')}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                    
                    {/* Signal Indicator Badge with Zoom Animations */}
                    {isWin ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-extrabold font-mono px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400 text-emerald-300 animate-zoom-green shadow-lg">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span>PRIZE CLAIMED (+₹{t.wonAmount})</span>
                      </span>
                    ) : isLoss ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-extrabold font-mono px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 shadow-lg">
                        <span className="relative flex h-2 w-2">
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-400"></span>
                        </span>
                        <span>SETTLED (-₹{t.price})</span>
                      </span>
                    ) : (
                      <span className="text-xs font-extrabold font-mono px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300">
                        ACTIVE
                      </span>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        soundFx.playClick();
                        setSelectedVoucherTx(t);
                      }}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-white transition-colors"
                      title="Share Voucher PNG"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )
        )}

        {/* DEPOSIT HISTORY */}
        {activeTab === 'deposits' && (
          sortedDeposits.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-slate-900/60 rounded-2xl border border-slate-800">
              No deposit records yet.
            </div>
          ) : (
            sortedDeposits.map((dep) => (
              <div 
                key={dep.id} 
                className="p-4 bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer transition-all"
                onClick={() => { soundFx.playClick(); setSelectedVoucherTx(dep); }}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-amber-400">{dep.id}</span>
                    <span className="text-xs text-slate-400">• {dep.date}</span>
                  </div>
                  <p className="text-xs font-mono text-slate-300">Method: <strong className="uppercase text-amber-300">{dep.method}</strong> | UTR: {dep.utr}</p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                  <span className="text-sm font-black text-emerald-400 font-mono">+₹{dep.amount.toLocaleString('en-IN')}</span>
                  <span className={`text-[11px] font-bold font-mono px-2.5 py-1 rounded-full border ${
                    dep.status === 'approved'
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : dep.status === 'rejected'
                      ? 'bg-rose-500/20 border-rose-500/30 text-rose-300'
                      : 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                  }`}>
                    {(dep.status || '').toString().toUpperCase()}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      soundFx.playClick();
                      setSelectedVoucherTx(dep);
                    }}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )
        )}

        {/* WITHDRAWAL HISTORY */}
        {activeTab === 'withdrawals' && (
          sortedWithdrawals.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-slate-900/60 rounded-2xl border border-slate-800">
              No withdrawal records yet.
            </div>
          ) : (
            sortedWithdrawals.map((wth) => (
              <div 
                key={wth.id} 
                className="p-4 bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer transition-all"
                onClick={() => { soundFx.playClick(); setSelectedVoucherTx(wth); }}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-amber-400">{wth.id}</span>
                    <span className="text-xs text-slate-400">• {wth.date}</span>
                  </div>
                  <p className="text-xs font-mono text-slate-300">A/C: {wth.accountNumber} ({wth.ifscCode}) | UPI: {wth.upiId}</p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                  <span className="text-sm font-black text-rose-400 font-mono">-₹{wth.amount.toLocaleString('en-IN')}</span>
                  <span className={`text-[11px] font-bold font-mono px-2.5 py-1 rounded-full border ${
                    wth.status === 'approved' || wth.status === 'completed'
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : wth.status === 'rejected'
                      ? 'bg-rose-500/20 border-rose-500/30 text-rose-300'
                      : 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                  }`}>
                    {wth.status === 'approved' ? 'SUCCESSFUL' : (wth.status || '').toString().toUpperCase()}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      soundFx.playClick();
                      setSelectedVoucherTx(wth);
                    }}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )
        )}

        {/* CASINO & LIVE GAMES HISTORY */}
        {activeTab === 'casino' && (
          filteredCasinoTx.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-slate-900/60 rounded-2xl border border-slate-800">
              No live casino bets or wins recorded yet.
            </div>
          ) : (
            filteredCasinoTx.map((tx) => {
              const isWin = tx.type.endsWith('_win') || tx.type === 'win' || tx.type === 'win_payout' || (tx.amount > 0 && !tx.type.endsWith('_bet'));
              const isRoulette = tx.type.includes('roulette') || tx.description.toLowerCase().includes('roulette');
              const isDragonTiger = tx.type.includes('dragon_tiger') || tx.description.toLowerCase().includes('dragon tiger');
              const isAndarBahar = tx.type.includes('andar_bahar') || tx.description.toLowerCase().includes('andar bahar');
              const gameTag = isRoulette ? '⚡ Roulette' : isDragonTiger ? '🐉 Dragon Tiger' : isAndarBahar ? '🃏 Andar Bahar' : '🎮 Casino';

              return (
                <div
                  key={tx.id}
                  className={`p-4 bg-slate-900/90 border rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer transition-all ${
                    isWin ? 'border-emerald-500/30 bg-emerald-950/10' : 'border-rose-500/30 bg-rose-950/10'
                  }`}
                  onClick={() => { soundFx.playClick(); setSelectedVoucherTx(tx); }}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-amber-400">{tx.id}</span>
                      <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-amber-300">
                        {gameTag}
                      </span>
                      <span className="text-xs text-slate-400">• {tx.date}</span>
                    </div>
                    <p className="text-xs font-mono text-slate-200 font-bold">{tx.description}</p>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                    <span className={`text-sm font-black font-mono ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isWin ? '+' : '-'}₹{Math.abs(tx.amount).toLocaleString('en-IN')}
                    </span>
                    <span className={`text-[11px] font-bold font-mono px-2.5 py-1 rounded-full border ${
                      isWin ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 animate-zoom-green' : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}>
                      {isWin ? 'WON (+PAYOUT)' : 'BET PLACED'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        soundFx.playClick();
                        setSelectedVoucherTx(tx);
                      }}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 transition-colors"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )
        )}

        {/* BONUSES & VOUCHERS HISTORY */}
        {activeTab === 'bonuses' && (
          bonusTx.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-slate-900/60 rounded-2xl border border-slate-800">
              No bonus or voucher rewards claimed yet.
            </div>
          ) : (
            bonusTx.map((tx) => {
              const isCredit = tx.amount >= 0;
              return (
                <div
                  key={tx.id}
                  className="p-4 bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer transition-all"
                  onClick={() => { soundFx.playClick(); setSelectedVoucherTx(tx); }}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-amber-400">{tx.id}</span>
                      <span className="text-xs text-slate-400">• {tx.date}</span>
                    </div>
                    <p className="text-xs font-mono text-slate-200 font-bold">{tx.description}</p>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                    <span className={`text-sm font-black font-mono ${isCredit ? 'text-cyan-400' : 'text-rose-400'}`}>
                      {isCredit ? '+' : ''}₹{Math.abs(tx.amount).toLocaleString('en-IN')}
                    </span>
                    <span className="text-[11px] font-bold font-mono px-2.5 py-1 rounded-full border bg-cyan-500/20 border-cyan-500/40 text-cyan-300">
                      CREDITED
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        soundFx.playClick();
                        setSelectedVoucherTx(tx);
                      }}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 transition-colors"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )
        )}

        {/* WALLET LEDGER */}
        {activeTab === 'ledger' && (
          <WalletLedger
            transactions={transactions}
            onOpenDeposit={onOpenDeposit}
            onOpenWithdraw={onOpenWithdraw}
          />
        )}

      </div>

      {/* Profile Photo Enlarge Modal */}
      {showPhotoModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-amber-500/40 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative flex flex-col items-center text-center space-y-4">
            
            {/* Top Right VIP Badge on Modal */}
            <div className="absolute top-4 right-4">
              <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow-md border ${currentTierInfo.badgeBg}`}>
                👑 {currentLevel} VIP
              </span>
            </div>

            {/* Close Modal Button */}
            <button
              onClick={() => {
                soundFx.playClick();
                setShowPhotoModal(false);
              }}
              className="absolute top-4 left-4 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <XCircle className="w-6 h-6" />
            </button>

            <h3 className="text-lg font-black text-amber-300 font-mono tracking-wide pt-2">
              USER PROFILE PHOTO
            </h3>

            {/* High Definition Avatar Image Frame */}
            <div className="relative p-1 rounded-3xl bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-600 shadow-2xl shadow-amber-500/30">
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-48 h-48 sm:w-56 sm:h-56 rounded-[22px] object-cover shadow-inner"
              />
            </div>

            {/* User Meta Summary */}
            <div className="space-y-1 font-mono">
              <h4 className="text-xl font-extrabold text-white">{user.name}</h4>
              <p className="text-xs text-amber-400/90 font-semibold">{user.email}</p>
              <p className="text-[11px] text-slate-400">Account ID: {user.id}</p>
            </div>

            <button
              onClick={() => {
                soundFx.playClick();
                setShowPhotoModal(false);
              }}
              className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all font-mono"
            >
              CLOSE PREVIEW
            </button>
          </div>
        </div>
      )}

      {/* Shareable HD Voucher Generator Modal */}
      {selectedVoucherTx && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <VoucherGenerator
            transaction={selectedVoucherTx}
            onClose={() => setSelectedVoucherTx(null)}
          />
        </div>
      )}

      {/* VIP Club Modal - Accessible ONLY by tapping VIP badge */}
      {showVipModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-amber-500/40 rounded-3xl p-6 max-w-2xl w-full shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => { soundFx.playClick(); setShowVipModal(false); }}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <XCircle className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shadow-lg">
                <Crown className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-white font-mono uppercase">VIP CLUB & LOYALTY REWARDS</h3>
                  <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${currentTierInfo.badgeBg}`}>
                    {currentLevel}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono">Earn 1 VIP Point for every ₹100 bet on Lottery & Roulette</p>
              </div>
            </div>

            {/* Claim Weekly Bonus */}
            <div className="flex items-center justify-between bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <div>
                <h4 className="text-xs font-bold text-white font-mono">Weekly Tier Payout</h4>
                <p className="text-[11px] text-slate-400 font-mono">Current Tier Bonus: ₹{currentTierInfo.weeklyBonusAmount}</p>
              </div>

              <button
                onClick={handleClaimBonus}
                disabled={hasClaimedWeeklyBonus || currentTierInfo.weeklyBonusAmount <= 0}
                className={`px-4 py-2 rounded-xl font-black font-mono text-xs flex items-center gap-1.5 transition-all shadow-lg ${
                  hasClaimedWeeklyBonus
                    ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                    : currentTierInfo.weeklyBonusAmount > 0
                    ? 'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-slate-950 hover:scale-105 active:scale-95'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {hasClaimedWeeklyBonus
                    ? 'CLAIMED'
                    : currentTierInfo.weeklyBonusAmount > 0
                    ? `CLAIM ₹${currentTierInfo.weeklyBonusAmount}`
                    : 'LOCKED'}
                </span>
              </button>
            </div>

            {/* Tier Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300 font-bold">
                  VIP Points: <strong className="text-amber-400">{vipPts.toLocaleString()} PTS</strong>
                </span>
                {nextTier ? (
                  <span className="text-slate-400">
                    Next Tier: <strong className="text-amber-300">{nextTier.level}</strong> ({pointsNeeded.toLocaleString()} pts needed)
                  </span>
                ) : (
                  <span className="text-emerald-400 font-bold">🎉 PLATINUM VIP STATUS REACHED</span>
                )}
              </div>

              <div className="w-full h-3 bg-slate-950 rounded-full border border-slate-800 overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>

            {/* VIP Tier Benefits Matrix */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 font-mono">
              {Object.values(VIP_TIERS).map((tier) => {
                const isCurrent = tier.level === currentLevel;
                return (
                  <div
                    key={tier.level}
                    className={`p-3 rounded-2xl border transition-all ${
                      isCurrent
                        ? 'bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/10'
                        : 'bg-slate-950/60 border-slate-800 opacity-80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-xs font-black ${tier.color}`}>{tier.level}</span>
                      {isCurrent && <span className="bg-amber-500 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase">YOU</span>}
                    </div>
                    <div className="text-[11px] text-slate-400 space-y-1">
                      <div>Limit: <strong className="text-slate-200">₹{tier.dailyWithdrawalLimit.toLocaleString()}/day</strong></div>
                      <div>Weekly Bonus: <strong className="text-emerald-400">₹{tier.weeklyBonusAmount}</strong></div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => { soundFx.playClick(); setShowVipModal(false); }}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-amber-300 font-mono font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              CLOSE VIP CLUB
            </button>
          </div>
        </div>
      )}

      {/* Bonus Wallet Information & Super Car Ticket Pricing Modal */}
      {showBonusInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-purple-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl overflow-hidden text-white space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Ambient Background Glow */}
            <div className="absolute -top-20 -right-20 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black font-mono text-purple-200">
                    BONUS WALLET INFO
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Real-time Balance & Super Car Rules
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  soundFx.playClick();
                  setShowBonusInfoModal(false);
                }}
                className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Current Bonus Balance Display */}
            <div className="p-4 bg-gradient-to-r from-purple-950/80 to-slate-900 rounded-2xl border border-purple-500/30 text-center space-y-1">
              <span className="text-[10px] font-mono font-bold uppercase text-purple-300 tracking-wider block">
                Available Bonus Balance
              </span>
              <span className="text-2xl sm:text-3xl font-black font-mono text-purple-200 block">
                ₹{(user.bonusBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] text-purple-300/80 font-mono">
                🎁 Usable for Three Super Car Draw Games!
              </span>
            </div>

            {/* Rule Explanations */}
            <div className="space-y-2 text-xs font-mono text-slate-300">
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-amber-300 block">Super Car Tickets Purchase:</strong>
                  <span>You can buy Super Car Draw tickets directly using Bonus Wallet without depositing new money.</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-2.5">
                <Zap className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-purple-300 block">Real-time Admin Pricing:</strong>
                  <span>Ticket prices for Bonus purchases and Cash purchases are dynamically controlled by the Admin and updated in real-time.</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-2.5">
                <Trophy className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-emerald-300 block">Winning Payouts:</strong>
                  <span>When you win with Bonus Tickets, your winnings are credited directly to your Bonus Wallet for extended gameplay!</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                soundFx.playClick();
                setShowBonusInfoModal(false);
              }}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-mono font-bold text-xs rounded-xl shadow-lg shadow-purple-500/20 transition-all cursor-pointer"
            >
              GOT IT
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
