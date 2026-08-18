import React, { useState, useEffect } from 'react';
import { 
  Dices, ShieldCheck, Sparkles, Save, CheckCircle2, AlertTriangle, 
  RotateCcw, Sliders, Eye, EyeOff, Target, Percent, TrendingUp, 
  ShieldAlert, Lock, Zap, RefreshCw, BarChart2, Radio
} from 'lucide-react';
import { RouletteConfig, RouletteRtpMode } from '../../types';
import { db } from '../../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { soundFx } from '../../utils/audio';

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const BLACK_NUMBERS = new Set([2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]);

const DEFAULT_ROULETTE_CONFIG: RouletteConfig = {
  rtpPercentage: 97.3,
  houseEdgePercentage: 2.7,
  rtpMode: 'european_standard',
  manualNextNumber: 17,
  manualNextNumberActive: false,
  minBet: 10,
  maxBet: 50000,
  maxTotalPayoutLimit: 200000,
  isRouletteEnabled: true,
  lastUpdated: new Date().toISOString(),
  updatedBy: 'Admin'
};

export const AdminRouletteManager: React.FC = () => {
  const [config, setConfig] = useState<RouletteConfig>(() => {
    try {
      const cached = localStorage.getItem('bg_roulette_config');
      if (cached) {
        return { ...DEFAULT_ROULETTE_CONFIG, ...JSON.parse(cached) };
      }
    } catch (e) {
      console.warn('Failed to parse cached roulette config:', e);
    }
    return DEFAULT_ROULETTE_CONFIG;
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Real-time Firestore sync
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'roulette_config', 'main'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<RouletteConfig>;
        setConfig((prev) => {
          const next = {
            ...prev,
            ...data,
            rtpPercentage: typeof data.rtpPercentage === 'number' ? data.rtpPercentage : prev.rtpPercentage,
            houseEdgePercentage: typeof data.houseEdgePercentage === 'number' 
              ? data.houseEdgePercentage 
              : Math.round((100 - (data.rtpPercentage || prev.rtpPercentage)) * 10) / 10,
            rtpMode: data.rtpMode || prev.rtpMode,
            isRouletteEnabled: data.isRouletteEnabled ?? prev.isRouletteEnabled
          };
          try {
            localStorage.setItem('bg_roulette_config', JSON.stringify(next));
          } catch (e) {}
          return next;
        });
      }
    }, (err) => console.warn('Roulette config listener error:', err.message));

    return () => unsub();
  }, []);

  const syncConfigLocallyAndLive = (updated: RouletteConfig) => {
    try {
      localStorage.setItem('bg_roulette_config', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('bg_roulette_config_change', { detail: updated }));
    } catch (e) {}
  };

  const handleRtpChange = (newRtp: number) => {
    const clampedRtp = Math.max(0, Math.min(99.5, Math.round(newRtp * 10) / 10));
    const calculatedHouseEdge = Math.round((100 - clampedRtp) * 10) / 10;
    const autoMode: RouletteRtpMode = clampedRtp < 97 ? 'house_protect' : 'european_standard';
    
    setConfig((prev) => {
      const updated: RouletteConfig = {
        ...prev,
        rtpPercentage: clampedRtp,
        houseEdgePercentage: calculatedHouseEdge,
        rtpMode: prev.rtpMode === 'manual_next_number' ? 'manual_next_number' : autoMode
      };
      syncConfigLocallyAndLive(updated);
      return updated;
    });
  };

  const handleHouseEdgeChange = (newEdge: number) => {
    const clampedEdge = Math.max(0.5, Math.min(100, Math.round(newEdge * 10) / 10));
    const calculatedRtp = Math.round((100 - clampedEdge) * 10) / 10;
    const autoMode: RouletteRtpMode = calculatedRtp < 97 ? 'house_protect' : 'european_standard';

    setConfig((prev) => {
      const updated: RouletteConfig = {
        ...prev,
        houseEdgePercentage: clampedEdge,
        rtpPercentage: calculatedRtp,
        rtpMode: prev.rtpMode === 'manual_next_number' ? 'manual_next_number' : autoMode
      };
      syncConfigLocallyAndLive(updated);
      return updated;
    });
  };

  const handleApplyPreset = (rtp: number, mode: RouletteRtpMode, label: string) => {
    soundFx.playClick();
    const clampedRtp = Math.max(0, Math.min(99.5, Math.round(rtp * 10) / 10));
    const calculatedHouseEdge = Math.round((100 - clampedRtp) * 10) / 10;
    
    setConfig((prev) => {
      const updated: RouletteConfig = {
        ...prev,
        rtpPercentage: clampedRtp,
        houseEdgePercentage: calculatedHouseEdge,
        rtpMode: mode
      };
      syncConfigLocallyAndLive(updated);
      return updated;
    });

    setStatusMessage(`Preset applied: ${label}`);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    soundFx.playClick();
    try {
      const payload: RouletteConfig = {
        ...config,
        rtpPercentage: Number(config.rtpPercentage),
        houseEdgePercentage: Math.round((100 - Number(config.rtpPercentage)) * 10) / 10,
        lastUpdated: new Date().toISOString(),
        updatedBy: 'Admin'
      };

      // Persist to local cache and fire event
      syncConfigLocallyAndLive(payload);

      // Persist to Firestore
      await setDoc(doc(db, 'roulette_config', 'main'), payload, { merge: true });
      soundFx.playCoin();
      setSaveSuccess(true);
      setStatusMessage('Live Roulette RTP & House Edge settings saved and active in real-time!');
      setTimeout(() => {
        setSaveSuccess(false);
        setStatusMessage(null);
      }, 4000);
    } catch (e: any) {
      console.error('Failed to save roulette config:', e);
      alert('Failed to save configuration: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const getNumberColor = (num: number): 'green' | 'red' | 'black' => {
    if (num === 0) return 'green';
    return RED_NUMBERS.has(num) ? 'red' : 'black';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Banner Notice */}
      <div className="p-5 bg-gradient-to-r from-slate-900 via-purple-950/50 to-slate-900 border border-purple-500/30 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0">
            <Percent className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-black uppercase font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                CASINO MATH & ALGORITHM CONTROL
              </span>
              <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1 font-mono">
                <EyeOff className="w-3 h-3" /> Hidden from User UI
              </span>
            </div>
            <h2 className="text-xl font-black text-white font-mono tracking-tight">
              Live Roulette RTP & House Edge Manager
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl font-mono">
              Configure manual Return-to-Player (RTP %) and House Edge. Changes are applied in real-time across all active live roulette tables.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={handleSaveConfig}
            disabled={isSaving}
            className="w-full md:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-mono font-black text-xs shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer hover:scale-102 active:scale-98"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>SAVING TO FIRESTORE...</span>
              </>
            ) : saveSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-slate-950" />
                <span>SETTINGS SAVED!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>SAVE RTP SETTINGS</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {statusMessage && (
        <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-mono flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Key Metric Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* RTP Gauge Card */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-2">
            <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
              <Percent className="w-4 h-4 text-emerald-400" />
              Target RTP %
            </span>
            <span className="text-[10px] text-emerald-400 font-bold">Return to Player</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-emerald-400 tracking-tight">
              {config.rtpPercentage.toFixed(1)}%
            </span>
            <span className="text-xs text-slate-400 font-mono">payout rate</span>
          </div>
          <div className="w-full bg-slate-950 h-2 rounded-full mt-3 overflow-hidden border border-slate-800">
            <div 
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, config.rtpPercentage)}%` }}
            />
          </div>
        </div>

        {/* House Edge Gauge Card */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-2">
            <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              House Edge %
            </span>
            <span className="text-[10px] text-amber-400 font-bold">Casino Retention</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-amber-400 tracking-tight">
              {config.houseEdgePercentage.toFixed(1)}%
            </span>
            <span className="text-xs text-slate-400 font-mono">net hold</span>
          </div>
          <div className="w-full bg-slate-950 h-2 rounded-full mt-3 overflow-hidden border border-slate-800">
            <div 
              className="bg-gradient-to-r from-amber-500 to-rose-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, config.houseEdgePercentage * 2.5)}%` }}
            />
          </div>
        </div>

        {/* Algorithm Mode Card */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-2">
            <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
              <Zap className="w-4 h-4 text-purple-400" />
              Algorithm Mode
            </span>
          </div>
          <div className="text-base font-black font-mono text-purple-300 truncate">
            {config.rtpMode === 'european_standard' && 'European Standard (97.3%)'}
            {config.rtpMode === 'dynamic_rtp' && 'Dynamic RTP Balancing'}
            {config.rtpMode === 'house_protect' && 'House Edge Protection'}
            {config.rtpMode === 'manual_next_number' && 'Manual Pocket Override'}
          </div>
          <p className="text-[11px] text-slate-400 font-mono mt-1">
            {config.rtpMode === 'european_standard' && 'Natural physics pseudo-random RNG'}
            {config.rtpMode === 'dynamic_rtp' && `Actively balances to ${config.rtpPercentage}% RTP`}
            {config.rtpMode === 'house_protect' && `Guarantees ${config.houseEdgePercentage}% House Retention`}
            {config.rtpMode === 'manual_next_number' && `Forced Next Pocket: #${config.manualNextNumber}`}
          </p>
        </div>

        {/* Game Active Toggle Card */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl relative overflow-hidden shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span className="font-bold uppercase tracking-wider">Live Table Status</span>
            <span className={`w-2.5 h-2.5 rounded-full ${config.isRouletteEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm font-mono font-bold text-white">
              {config.isRouletteEnabled ? 'Table Open (Live)' : 'Table Paused'}
            </span>
            <button
              onClick={() => {
                soundFx.playClick();
                setConfig((prev) => ({ ...prev, isRouletteEnabled: !prev.isRouletteEnabled }));
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold cursor-pointer transition-all ${
                config.isRouletteEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
              }`}
            >
              {config.isRouletteEnabled ? 'Disable Game' : 'Enable Game'}
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 1: Dual Interactive Slider & Inputs */}
      <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-black text-white font-mono flex items-center gap-2">
              <Sliders className="w-5 h-5 text-amber-400" />
              1. Manual RTP & House Edge Dual Configuration
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Adjust the slider or type exact values. House Edge and RTP will calculate automatically in real-time.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-slate-400">Sum check:</span>
            <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
              RTP ({config.rtpPercentage.toFixed(1)}%) + Edge ({config.houseEdgePercentage.toFixed(1)}%) = 100.0%
            </span>
          </div>
        </div>

        {/* Dual Input Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* RTP Control Box */}
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Percent className="w-4 h-4" />
                Return To Player (RTP %)
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.1"
                  min="10"
                  max="99.5"
                  value={config.rtpPercentage}
                  onChange={(e) => handleRtpChange(parseFloat(e.target.value) || 97.3)}
                  className="w-20 px-2 py-1 bg-slate-900 border border-emerald-500/40 focus:border-emerald-400 text-emerald-300 font-mono font-black text-sm rounded-xl text-center outline-none"
                />
                <span className="text-xs font-mono text-emerald-400 font-bold">%</span>
              </div>
            </div>

            <input
              type="range"
              min="50"
              max="99"
              step="0.5"
              value={config.rtpPercentage}
              onChange={(e) => handleRtpChange(parseFloat(e.target.value))}
              className="w-full accent-emerald-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />

            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>50% (High Retention)</span>
              <span>80% (Mid)</span>
              <span>97.3% (European Classic)</span>
              <span>99% (Max)</span>
            </div>
          </div>

          {/* House Edge Control Box */}
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold font-mono text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" />
                Casino House Edge (Edge %)
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="90"
                  value={config.houseEdgePercentage}
                  onChange={(e) => handleHouseEdgeChange(parseFloat(e.target.value) || 2.7)}
                  className="w-20 px-2 py-1 bg-slate-900 border border-amber-500/40 focus:border-amber-400 text-amber-300 font-mono font-black text-sm rounded-xl text-center outline-none"
                />
                <span className="text-xs font-mono text-amber-400 font-bold">%</span>
              </div>
            </div>

            <input
              type="range"
              min="1"
              max="50"
              step="0.5"
              value={config.houseEdgePercentage}
              onChange={(e) => handleHouseEdgeChange(parseFloat(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />

            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>1% (Very Low Hold)</span>
              <span>2.7% (European Classic)</span>
              <span>15% (Standard)</span>
              <span>50% (High Hold)</span>
            </div>
          </div>
        </div>

        {/* 1-Click Preset Buttons */}
        <div className="space-y-2">
          <label className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider block">
            Quick 1-Click RTP & House Edge Presets
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {[
              { rtp: 97.3, edge: 2.7, mode: 'european_standard' as RouletteRtpMode, label: 'Classic European', desc: '97.3% RTP (2.7% Edge)', icon: '🎯' },
              { rtp: 92.0, edge: 8.0, mode: 'dynamic_rtp' as RouletteRtpMode, label: 'Balanced Casino', desc: '92.0% RTP (8.0% Edge)', icon: '⚖️' },
              { rtp: 85.0, edge: 15.0, mode: 'house_protect' as RouletteRtpMode, label: 'House Edge 15%', desc: '85.0% RTP (15.0% Edge)', icon: '🛡️' },
              { rtp: 75.0, edge: 25.0, mode: 'house_protect' as RouletteRtpMode, label: 'High Retention', desc: '75.0% RTP (25.0% Edge)', icon: '🔒' },
              { rtp: 60.0, edge: 40.0, mode: 'house_protect' as RouletteRtpMode, label: 'Ultra Retention', desc: '60.0% RTP (40.0% Edge)', icon: '💎' },
            ].map((preset) => {
              const isMatch = Math.abs(config.rtpPercentage - preset.rtp) < 0.2;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleApplyPreset(preset.rtp, preset.mode, preset.label)}
                  className={`p-3 rounded-2xl border text-left font-mono transition-all cursor-pointer ${
                    isMatch
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-2 ring-amber-400/30 shadow-md'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                    <span>{preset.icon} {preset.label}</span>
                    {isMatch && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />}
                  </div>
                  <div className="text-[11px] font-bold text-amber-400">{preset.desc}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION 2: Operation Engine Modes */}
      <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-xl space-y-4">
        <div>
          <h3 className="text-base font-black text-white font-mono flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-400" />
            2. Outcome Resolution Engine Mode
          </h3>
          <p className="text-xs text-slate-400 font-mono">
            Select how the Live Roulette backend calculates the winning pocket for each 26-second round.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono">
          {[
            {
              id: 'european_standard' as RouletteRtpMode,
              title: 'European Standard (Natural RNG)',
              tag: '97.3% Natural Physics',
              desc: 'Pure mathematical physics simulation. Pockets land with 100% natural European roulette odds (36/37 payout rate = 97.30% RTP).'
            },
            {
              id: 'dynamic_rtp' as RouletteRtpMode,
              title: 'Dynamic RTP Balancing Engine',
              tag: `${config.rtpPercentage.toFixed(1)}% Target`,
              desc: `Reads live bets across active players and dynamically biases outcome distribution to match the configured ${config.rtpPercentage}% target RTP.`
            },
            {
              id: 'house_protect' as RouletteRtpMode,
              title: 'House Edge Profit Protection',
              tag: `${config.houseEdgePercentage.toFixed(1)}% House Hold`,
              desc: `Guarantees that the casino retains at least ${config.houseEdgePercentage}% margin by preventing oversized player jackpot runs during heavy bet rounds.`
            },
            {
              id: 'manual_next_number' as RouletteRtpMode,
              title: 'Manual Next Pocket Override',
              tag: `Pocket #${config.manualNextNumber ?? 0} Forced`,
              desc: 'Admin directly designates the exact winning number (0 to 36) for the upcoming spin round.'
            }
          ].map((modeItem) => {
            const isSelected = config.rtpMode === modeItem.id;
            return (
              <div
                key={modeItem.id}
                onClick={() => {
                  soundFx.playClick();
                  setConfig((prev) => ({ ...prev, rtpMode: modeItem.id }));
                }}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-purple-950/60 border-purple-400 ring-2 ring-purple-400/40 shadow-xl'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${isSelected ? 'border-purple-400 bg-purple-400' : 'border-slate-600'}`}>
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                    </span>
                    <span className="text-xs font-black text-white">{modeItem.title}</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                    {modeItem.tag}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {modeItem.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: Manual Pocket Picker Grid (0 to 36) */}
      <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-black text-white font-mono flex items-center gap-2">
              <Dices className="w-5 h-5 text-amber-400" />
              3. Interactive Pocket Selector (For Manual Win Control)
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Click any number to designate it as the Manual Target pocket.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                setConfig((prev) => {
                  const updated: RouletteConfig = {
                    ...prev,
                    manualNextNumberActive: !prev.manualNextNumberActive,
                    rtpMode: !prev.manualNextNumberActive ? 'manual_next_number' : (prev.rtpPercentage < 97 ? 'house_protect' : 'european_standard')
                  };
                  syncConfigLocallyAndLive(updated);
                  return updated;
                });
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold cursor-pointer transition-all ${
                config.manualNextNumberActive
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
              }`}
            >
              {config.manualNextNumberActive ? '✓ Manual Override ACTIVE' : 'Manual Override INACTIVE'}
            </button>
          </div>
        </div>

        {/* Selected Manual Pocket Summary Banner */}
        <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between font-mono">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg text-white shadow-md ${
              getNumberColor(config.manualNextNumber ?? 0) === 'green'
                ? 'bg-emerald-600 border border-emerald-400'
                : getNumberColor(config.manualNextNumber ?? 0) === 'red'
                ? 'bg-rose-600 border border-rose-400'
                : 'bg-slate-800 border border-slate-600'
            }`}>
              {config.manualNextNumber ?? 0}
            </div>
            <div>
              <span className="text-xs font-black text-white block">
                Pocket #{config.manualNextNumber ?? 0} ({getNumberColor(config.manualNextNumber ?? 0).toUpperCase()})
              </span>
              <span className="text-[10px] text-slate-400 block">
                {config.manualNextNumberActive 
                  ? '⚡ This exact number will land on the next roulette spin.' 
                  : 'Inactive - Click button above or select a number below & click "Save RTP Settings".'}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-500 uppercase block">Single Number Payout</span>
            <span className="text-xs font-black text-emerald-400 font-mono">36x multiplier</span>
          </div>
        </div>

        {/* 37 Wheel Pockets Grid (0 to 36) */}
        <div className="space-y-2">
          {/* Zero Pocket */}
          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              setConfig((prev) => {
                const updated: RouletteConfig = { ...prev, manualNextNumber: 0, manualNextNumberActive: true, rtpMode: 'manual_next_number' };
                syncConfigLocallyAndLive(updated);
                return updated;
              });
            }}
            className={`w-full py-2.5 rounded-xl font-mono font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              config.manualNextNumber === 0
                ? 'bg-emerald-600 text-white ring-2 ring-emerald-400 shadow-lg'
                : 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/60'
            }`}
          >
            <span>0 GREEN (ZERO POCKET)</span>
            {config.manualNextNumber === 0 && <CheckCircle2 className="w-4 h-4" />}
          </button>

          {/* Numbers 1 to 36 Grid */}
          <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
            {Array.from({ length: 36 }, (_, i) => i + 1).map((num) => {
              const color = getNumberColor(num);
              const isSelected = config.manualNextNumber === num;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setConfig((prev) => {
                      const updated: RouletteConfig = { ...prev, manualNextNumber: num, manualNextNumberActive: true, rtpMode: 'manual_next_number' };
                      syncConfigLocallyAndLive(updated);
                      return updated;
                    });
                  }}
                  className={`h-11 rounded-xl font-mono font-black text-xs flex flex-col items-center justify-center transition-all cursor-pointer relative ${
                    isSelected
                      ? 'ring-2 ring-amber-400 shadow-xl scale-105 z-10'
                      : 'opacity-90 hover:opacity-100 hover:scale-102'
                  } ${
                    color === 'red'
                      ? isSelected ? 'bg-rose-600 text-white' : 'bg-rose-950/80 text-rose-200 border border-rose-800/60'
                      : isSelected ? 'bg-slate-900 text-white border-2 border-slate-400' : 'bg-slate-950 text-slate-200 border border-slate-800'
                  }`}
                >
                  <span>{num}</span>
                  <span className="text-[8px] opacity-70 uppercase">{color[0]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION 4: Bet Limits & Payout Safeguards */}
      <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-xl space-y-4 font-mono">
        <h3 className="text-base font-black text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          4. Table Bet Limits & Maximum Risk Caps
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Minimum Bet Per Chip
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-amber-400">₹</span>
              <input
                type="number"
                min="1"
                max="10000"
                value={config.minBet}
                onChange={(e) => setConfig((prev) => ({ ...prev, minBet: Math.max(1, parseInt(e.target.value, 10) || 10) }))}
                className="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-xl text-white font-mono font-bold text-sm focus:border-amber-400 outline-none"
              />
            </div>
          </div>

          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Maximum Bet Per Round
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-amber-400">₹</span>
              <input
                type="number"
                min="100"
                max="1000000"
                value={config.maxBet}
                onChange={(e) => setConfig((prev) => ({ ...prev, maxBet: Math.max(100, parseInt(e.target.value, 10) || 50000) }))}
                className="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-xl text-white font-mono font-bold text-sm focus:border-amber-400 outline-none"
              />
            </div>
          </div>

          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Max Total Round Payout Cap
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-amber-400">₹</span>
              <input
                type="number"
                min="1000"
                max="5000000"
                value={config.maxTotalPayoutLimit || 200000}
                onChange={(e) => setConfig((prev) => ({ ...prev, maxTotalPayoutLimit: Math.max(1000, parseInt(e.target.value, 10) || 200000) }))}
                className="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-xl text-white font-mono font-bold text-sm focus:border-amber-400 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Confidentiality Reminder */}
        <div className="p-3.5 bg-purple-950/30 border border-purple-500/30 rounded-2xl text-[11px] text-purple-200 leading-relaxed flex items-center gap-3">
          <Lock className="w-5 h-5 text-purple-400 shrink-0" />
          <span>
            <strong>গোপনীয়তা নিশ্চয়তা:</strong> এই আরটিপি (RTP) এবং হাউজ এজ (House Edge) সেটিংস শুধুমাত্র এই এডমিন প্যানেলে দৃশ্যমান। প্লেয়ার ইন্টারফেস বা লাইভ রুলেট স্ক্রিনে কোনো প্রকার আরটিপি বা পার্সেন্টেজ দেখা যাবে না।
          </span>
        </div>
      </div>

    </div>
  );
};
