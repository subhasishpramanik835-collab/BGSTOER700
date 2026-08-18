import React, { useState } from 'react';
import { Home, Flame, ArrowUpRight, Ticket, User as UserIcon, Disc, Award, Sparkles, X, ChevronRight } from 'lucide-react';
import { soundFx } from '../utils/audio';
import dragonTigerBannerImg from '../assets/images/banner_dragon_tiger_1786806363496.jpg';
import andarBaharBannerImg from '../assets/images/banner_andar_bahar_1786806380441.jpg';
import rouletteBannerImg from '../assets/images/banner_roulette_1786806396481.jpg';

export type NavTab = 'home' | 'lottery' | 'withdrawal' | 'tickets' | 'results' | 'lucky_wheel' | 'profile';

interface BottomNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  activeTicketsCount: number;
  onOpenRoulette?: () => void;
  onOpenAndarBahar?: () => void;
  onOpenDragonTiger?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  activeTicketsCount,
  onOpenRoulette,
  onOpenAndarBahar,
  onOpenDragonTiger
}) => {
  const [isCasinoMenuOpen, setIsCasinoMenuOpen] = useState<boolean>(false);

  const tabs = [
    { 
      id: 'home' as NavTab, 
      label: 'Home', 
      icon: Home,
      animationClass: 'group-hover:scale-110 group-active:scale-95'
    },
    { 
      id: 'lottery' as NavTab, 
      label: 'Lottery', 
      icon: Flame,
      animationClass: 'group-hover:scale-110 group-active:scale-95'
    },
    { 
      id: 'withdrawal' as NavTab, 
      label: 'Withdraw', 
      icon: ArrowUpRight,
      animationClass: 'group-hover:scale-110 group-active:scale-95'
    },
    { 
      id: 'tickets' as NavTab, 
      label: 'Tickets', 
      icon: Ticket, 
      badge: activeTicketsCount,
      animationClass: 'group-hover:-rotate-12 group-active:rotate-0'
    },
    { 
      id: 'profile' as NavTab, 
      label: 'Profile', 
      icon: UserIcon,
      animationClass: 'group-hover:-translate-y-1 group-active:translate-y-0'
    }
  ];

  const handleCasinoClick = () => {
    soundFx.playClick();
    if (onOpenRoulette && onOpenAndarBahar) {
      setIsCasinoMenuOpen(true);
    } else if (onOpenAndarBahar) {
      onOpenAndarBahar();
    } else if (onOpenRoulette) {
      onOpenRoulette();
    }
  };

  return (
    <>
      {/* Casino Selection Bottom Sheet Modal */}
      {isCasinoMenuOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-3 animate-in fade-in"
          onClick={() => setIsCasinoMenuOpen(false)}
        >
          <div 
            className="w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/40 rounded-3xl p-5 shadow-2xl space-y-4 font-mono animate-in slide-in-from-bottom-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-tight">BETGURU LIVE CASINO</h3>
                  <p className="text-[10px] text-amber-300">Select a real-time HD casino game to play</p>
                </div>
              </div>
              <button 
                onClick={() => setIsCasinoMenuOpen(false)}
                className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {/* Dragon Tiger Card */}
              {onOpenDragonTiger && (
                <button
                  onClick={() => {
                    setIsCasinoMenuOpen(false);
                    onOpenDragonTiger();
                  }}
                  className="group relative p-3.5 rounded-2xl border border-red-500/40 hover:border-red-400 overflow-hidden flex items-center justify-between text-left transition-all hover:scale-[1.02] shadow-xl cursor-pointer min-h-[90px]"
                >
                  <img 
                    src={dragonTigerBannerImg} 
                    alt="Dragon Tiger" 
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 group-hover:brightness-110 transition-all duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/75 to-slate-950/40 pointer-events-none" />
                  
                  <div className="relative z-10 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-red-600/30 border border-red-400/50 flex items-center justify-center text-2xl shadow-md backdrop-blur-sm">
                      🐉
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-white uppercase tracking-wide">Dragon Tiger</span>
                        <span className="bg-rose-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase animate-pulse">
                          HOT LIVE
                        </span>
                      </div>
                      <p className="text-[10px] text-red-200">2-Card Asian Classic • 1:1 & 9:1 Tie Payout</p>
                    </div>
                  </div>
                  <ChevronRight className="relative z-10 w-5 h-5 text-red-400 group-hover:translate-x-1 transition-transform" />
                </button>
              )}

              {/* Andar Bahar Card */}
              {onOpenAndarBahar && (
                <button
                  onClick={() => {
                    setIsCasinoMenuOpen(false);
                    onOpenAndarBahar();
                  }}
                  className="group relative p-3.5 rounded-2xl border border-emerald-500/40 hover:border-emerald-400 overflow-hidden flex items-center justify-between text-left transition-all hover:scale-[1.02] shadow-xl cursor-pointer min-h-[90px]"
                >
                  <img 
                    src={andarBaharBannerImg} 
                    alt="Andar Bahar" 
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 group-hover:brightness-110 transition-all duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/75 to-slate-950/40 pointer-events-none" />

                  <div className="relative z-10 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-600/30 border border-emerald-400/50 flex items-center justify-center text-2xl shadow-md backdrop-blur-sm">
                      🎴
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-white uppercase tracking-wide">Andar Bahar</span>
                        <span className="bg-emerald-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase animate-pulse">
                          HOT NEW
                        </span>
                      </div>
                      <p className="text-[10px] text-emerald-200">Match Joker Card • 2.0x Payout • Instant Deal</p>
                    </div>
                  </div>
                  <ChevronRight className="relative z-10 w-5 h-5 text-emerald-400 group-hover:translate-x-1 transition-transform" />
                </button>
              )}

              {/* Lightning Roulette Card */}
              {onOpenRoulette && (
                <button
                  onClick={() => {
                    setIsCasinoMenuOpen(false);
                    onOpenRoulette();
                  }}
                  className="group relative p-3.5 rounded-2xl border border-amber-500/40 hover:border-amber-400 overflow-hidden flex items-center justify-between text-left transition-all hover:scale-[1.02] shadow-xl cursor-pointer min-h-[90px]"
                >
                  <img 
                    src={rouletteBannerImg} 
                    alt="Lightning Roulette" 
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 group-hover:brightness-110 transition-all duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/75 to-slate-950/40 pointer-events-none" />

                  <div className="relative z-10 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-amber-600/30 border border-amber-400/50 flex items-center justify-center text-amber-400 shadow-md backdrop-blur-sm">
                      <Disc className="w-6 h-6 animate-spin [animation-duration:8s]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-white uppercase tracking-wide flex items-center gap-1">
                          <span>⚡</span> Lightning Roulette
                        </span>
                        <span className="bg-amber-500 text-slate-950 text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase animate-pulse">
                          500x LIVE
                        </span>
                      </div>
                      <p className="text-[10px] text-amber-200">37-Pocket 3D Wheel • Up to 500x Lucky Multipliers</p>
                    </div>
                  </div>
                  <ChevronRight className="relative z-10 w-5 h-5 text-amber-400 group-hover:translate-x-1 transition-transform" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 border-t border-amber-500/30 backdrop-blur-xl px-1.5 py-1.5 shadow-2xl shadow-black">
        <div className="max-w-md mx-auto flex items-center justify-around">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => {
                  soundFx.playClick();
                  onSelectTab(tab.id);
                }}
                className={`group relative flex flex-col items-center justify-center py-1 px-2 rounded-2xl transition-all duration-200 active:opacity-50 active:scale-90 cursor-pointer ${
                  isActive
                    ? 'text-amber-400 font-extrabold scale-105'
                    : 'text-slate-400 hover:text-slate-100 font-medium'
                }`}
              >
                {/* Highlight Glow for Active Tab */}
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-t from-amber-500/20 to-amber-500/5 rounded-2xl blur-xs -z-10 animate-pulse"></div>
                )}

                <div className="relative">
                  <Icon
                    className={`w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2] transition-transform duration-200 ease-out ${tab.animationClass} ${
                      isActive
                        ? 'text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.6)]'
                        : 'text-slate-400 group-hover:text-amber-300'
                    }`}
                  />

                  {/* Badge if available */}
                  {tab.badge && tab.badge > 0 ? (
                    <span className="absolute -top-1.5 -right-2 bg-emerald-500 text-slate-950 text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-slate-950 shadow-md animate-bounce">
                      {tab.badge}
                    </span>
                  ) : null}
                </div>

                <span className={`text-[9px] sm:text-[10px] mt-0.5 tracking-tight transition-colors duration-200 ${isActive ? 'text-amber-300 font-bold' : 'text-slate-400 group-hover:text-slate-200'}`}>
                  {tab.label}
                </span>

                {/* Active Indicator Pill */}
                {isActive && (
                  <div className="w-4 h-0.5 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 rounded-full mt-0.5 shadow-sm shadow-amber-500/50"></div>
                )}
              </button>
            );
          })}

          {/* Dedicated Live Casino Launcher */}
          {(onOpenRoulette || onOpenAndarBahar) && (
            <button
              onClick={handleCasinoClick}
              className="group relative flex flex-col items-center justify-center py-1 px-2 rounded-2xl transition-all duration-200 text-amber-400 font-extrabold active:opacity-50 active:scale-90 cursor-pointer"
              title="Play Live Casino (Andar Bahar & Roulette)"
            >
              <div className="relative">
                <Disc className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 animate-spin [animation-duration:6s] drop-shadow-[0_0_12px_rgba(245,158,11,0.7)] group-hover:scale-110 transition-transform" />
                <span className="absolute -top-1.5 -right-2 bg-rose-600 text-white text-[7px] font-black px-1 py-0.2 rounded-full animate-pulse border border-rose-400 shadow-md">
                  LIVE
                </span>
              </div>
              <span className="text-[9px] sm:text-[10px] mt-0.5 tracking-tight text-amber-300 font-bold group-hover:text-amber-200">
                Casino
              </span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
};

