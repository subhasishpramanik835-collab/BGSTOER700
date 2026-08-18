import React, { useState, useEffect } from 'react';
import { 
  Percent, ShieldCheck, Sparkles, Save, CheckCircle2, AlertTriangle, 
  RotateCcw, Sliders, Eye, Target, TrendingUp, 
  ShieldAlert, Lock, Zap, RefreshCw, BarChart2, Flame, Layers, Dices, 
  Settings2, Activity, HelpCircle, ArrowRight
} from 'lucide-react';
import { LiveGameRtpSettings } from '../../types';
import { db } from '../../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { soundFx } from '../../utils/audio';

export const DEFAULT_RTP_SETTINGS: Record<string, LiveGameRtpSettings> = {
  roulette: {
    id: 'roulette',
    gameName: 'Live European Roulette 3D',
    rtpPercentage: 97.3,
    houseEdgePercentage: 2.7,
    rtpMode: 'fair_rng',
    manualForceTarget: 'random',
    manualForceActive: false,
    minBet: 10,
    maxBet: 50000,
    isEnabled: true,
    targetProfitMargin: 2.7,
    multiplierPrimary: 36.0, // Straight-up
    multiplierSecondary: 2.0, // Red/Black/Even/Odd
    notes: 'European single-zero wheel with natural 2.70% house edge.',
    updatedAt: new Date().toISOString(),
    updatedBy: 'Admin'
  },
  andar_bahar: {
    id: 'andar_bahar',
    gameName: 'Live Andar Bahar HD Casino',
    rtpPercentage: 96.5,
    houseEdgePercentage: 3.5,
    rtpMode: 'fair_rng',
    manualForceTarget: 'random',
    manualForceActive: false,
    minBet: 10,
    maxBet: 50000,
    isEnabled: true,
    targetProfitMargin: 3.5,
    multiplierPrimary: 1.95, // Andar
    multiplierSecondary: 2.0,  // Bahar
    notes: 'Standard 52-card Asian card match duel.',
    updatedAt: new Date().toISOString(),
    updatedBy: 'Admin'
  },
  dragon_tiger: {
    id: 'dragon_tiger',
    gameName: 'Live Dragon Tiger Asian Classic',
    rtpPercentage: 96.8,
    houseEdgePercentage: 3.2,
    rtpMode: 'fair_rng',
    manualForceTarget: 'random',
    manualForceActive: false,
    minBet: 10,
    maxBet: 50000,
    isEnabled: true,
    targetProfitMargin: 3.2,
    multiplierPrimary: 2.0, // Dragon / Tiger (1:1)
    multiplierSecondary: 2.0,
    multiplierSpecial: 9.0, // Tie (8:1)
    notes: '2-card high rank showdown with 8:1 Tie payout.',
    updatedAt: new Date().toISOString(),
    updatedBy: 'Admin'
  }
};

export const AdminLiveGameRTPManager: React.FC = () => {
  const [activeGame, setActiveGame] = useState<'roulette' | 'andar_bahar' | 'dragon_tiger'>('roulette');
  const [settings, setSettings] = useState<Record<string, LiveGameRtpSettings>>(() => {
    try {
      const cached = localStorage.getItem('bg_game_settings_cache');
      if (cached) {
        return { ...DEFAULT_RTP_SETTINGS, ...JSON.parse(cached) };
      }
    } catch (e) {
      console.warn('Failed to parse cached game_settings:', e);
    }
    return DEFAULT_RTP_SETTINGS;
  });

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Real-time Firestore sync on `game_settings` collection
  useEffect(() => {
    const unsubRoulette = onSnapshot(doc(db, 'game_settings', 'roulette'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<LiveGameRtpSettings>;
        setSettings((prev) => ({
          ...prev,
          roulette: { ...prev.roulette, ...data }
        }));
      }
    }, (err) => console.warn('game_settings roulette listener notice:', err.message));

    const unsubAndarBahar = onSnapshot(doc(db, 'game_settings', 'andar_bahar'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<LiveGameRtpSettings>;
        setSettings((prev) => ({
          ...prev,
          andar_bahar: { ...prev.andar_bahar, ...data }
        }));
      }
    }, (err) => console.warn('game_settings andar_bahar listener notice:', err.message));

    const unsubDragonTiger = onSnapshot(doc(db, 'game_settings', 'dragon_tiger'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<LiveGameRtpSettings>;
        setSettings((prev) => ({
          ...prev,
          dragon_tiger: { ...prev.dragon_tiger, ...data }
        }));
      }
    }, (err) => console.warn('game_settings dragon_tiger listener notice:', err.message));

    return () => {
      unsubRoulette();
      unsubAndarBahar();
      unsubDragonTiger();
    };
  }, []);

  const currentSetting = settings[activeGame] || DEFAULT_RTP_SETTINGS[activeGame];

  // Handle RTP change (dynamically adjusts House Edge)
  const handleRtpChange = (newRtp: number) => {
    const clampedRtp = Math.max(50, Math.min(99.9, Math.round(newRtp * 10) / 10));
    const calculatedEdge = Math.round((100 - clampedRtp) * 10) / 10;
    
    setSettings((prev) => ({
      ...prev,
      [activeGame]: {
        ...prev[activeGame],
        rtpPercentage: clampedRtp,
        houseEdgePercentage: calculatedEdge,
        targetProfitMargin: calculatedEdge
      }
    }));
  };

  // Handle House Edge change (dynamically adjusts RTP)
  const handleHouseEdgeChange = (newEdge: number) => {
    const clampedEdge = Math.max(0.1, Math.min(50, Math.round(newEdge * 10) / 10));
    const calculatedRtp = Math.round((100 - clampedEdge) * 10) / 10;
    
    setSettings((prev) => ({
      ...prev,
      [activeGame]: {
        ...prev[activeGame],
        houseEdgePercentage: clampedEdge,
        rtpPercentage: calculatedRtp,
        targetProfitMargin: clampedEdge
      }
    }));
  };

  // Save changes to Firestore collection `game_settings` & backward-compatible documents
  const handleSaveSettings = async () => {
    setIsSaving(true);
    setStatusMessage(null);
    soundFx.playClick();

    try {
      const nowIso = new Date().toISOString();
      const updatedCurrent: LiveGameRtpSettings = {
        ...currentSetting,
        updatedAt: nowIso,
        updatedBy: 'Admin'
      };

      // 1. Primary write to `game_settings` collection
      await setDoc(doc(db, 'game_settings', activeGame), updatedCurrent, { merge: true });

      // 2. Backward compatibility writes to legacy config docs
      if (activeGame === 'roulette') {
        await setDoc(doc(db, 'roulette_config', 'main'), {
          rtpPercentage: updatedCurrent.rtpPercentage,
          houseEdgePercentage: updatedCurrent.houseEdgePercentage,
          rtpMode: updatedCurrent.rtpMode === 'fair_rng' ? 'european_standard' : updatedCurrent.rtpMode === 'house_protect' ? 'house_protection' : 'custom_rtp',
          isRouletteEnabled: updatedCurrent.isEnabled,
          minBet: updatedCurrent.minBet,
          maxBet: updatedCurrent.maxBet,
          lastUpdated: nowIso,
          updatedBy: 'Admin'
        }, { merge: true }).catch(() => {});
      } else if (activeGame === 'andar_bahar') {
        await setDoc(doc(db, 'andar_bahar_config', 'main'), {
          rtpPercentage: updatedCurrent.rtpPercentage,
          houseEdgePercentage: updatedCurrent.houseEdgePercentage,
          rtpMode: updatedCurrent.rtpMode === 'house_protect' ? 'house_protect' : updatedCurrent.rtpMode === 'manual_force' ? 'manual_force_winner' : 'fair_rng',
          isEnabled: updatedCurrent.isEnabled,
          andarMultiplier: updatedCurrent.multiplierPrimary || 1.95,
          baharMultiplier: updatedCurrent.multiplierSecondary || 2.0,
          minBet: updatedCurrent.minBet,
          maxBet: updatedCurrent.maxBet,
          updatedAt: nowIso,
          updatedBy: 'Admin'
        }, { merge: true }).catch(() => {});
      } else if (activeGame === 'dragon_tiger') {
        await setDoc(doc(db, 'dragon_tiger_config', 'main'), {
          rtpPercentage: updatedCurrent.rtpPercentage,
          houseEdgePercentage: updatedCurrent.houseEdgePercentage,
          rtpMode: updatedCurrent.rtpMode === 'house_protect' ? 'house_protect' : updatedCurrent.rtpMode === 'manual_force' ? 'manual_force_winner' : 'fair_rng',
          isEnabled: updatedCurrent.isEnabled,
          dragonMultiplier: updatedCurrent.multiplierPrimary || 2.0,
          tigerMultiplier: updatedCurrent.multiplierSecondary || 2.0,
          tieMultiplier: updatedCurrent.multiplierSpecial || 9.0,
          minBet: updatedCurrent.minBet,
          maxBet: updatedCurrent.maxBet,
          updatedAt: nowIso,
          updatedBy: 'Admin'
        }, { merge: true }).catch(() => {});
      }

      // Update local storage cache
      try {
        localStorage.setItem('bg_game_settings_cache', JSON.stringify(settings));
        localStorage.setItem(`bg_game_settings_${activeGame}`, JSON.stringify(updatedCurrent));
      } catch (_) {}

      setSaveSuccess(true);
      setStatusMessage(`Real-time RTP settings for ${updatedCurrent.gameName} updated successfully in Firestore collection 'game_settings'!`);
      soundFx.playCoin();

      setTimeout(() => {
        setSaveSuccess(false);
        setStatusMessage(null);
      }, 4000);
    } catch (err: any) {
      console.error('Error saving game_settings:', err);
      setStatusMessage(`Failed to save settings: ${err.message || 'Firestore error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to default settings
  const handleResetToDefaults = () => {
    soundFx.playClick();
    if (window.confirm(`Reset ${currentSetting.gameName} RTP to standard default values?`)) {
      const defaults = DEFAULT_RTP_SETTINGS[activeGame];
      setSettings((prev) => ({
        ...prev,
        [activeGame]: { ...defaults }
      }));
      setStatusMessage('Reset to defaults in local state. Click "Save Real-Time Settings" to persist.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-400 shadow-inner">
            <Percent className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white uppercase tracking-wider">
                Live Games RTP & House Edge Controller
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                collection: game_settings
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Strictly hidden from standard user interface. Real-time probability algorithms, house edge controls & instant payouts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetToDefaults}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold rounded-xl border border-slate-700 transition-all flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
          <button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-amber-500 hover:from-indigo-400 hover:to-amber-400 text-slate-950 text-xs font-mono font-black rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : saveSuccess ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isSaving ? 'Saving...' : saveSuccess ? 'Saved to Firestore!' : 'Save Real-Time Settings'}</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className={`p-4 rounded-2xl border text-xs font-mono flex items-center gap-3 animate-in fade-in duration-200 ${
          saveSuccess 
            ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' 
            : 'bg-indigo-950/60 border-indigo-500/40 text-indigo-300'
        }`}>
          {saveSuccess ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-5 h-5 text-indigo-400 shrink-0" />}
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Live Games Selector Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { id: 'roulette', label: 'European Roulette 3D', icon: Dices, badge: '97.3% Default', color: 'from-amber-950/60 to-slate-900 border-amber-500/30' },
          { id: 'andar_bahar', label: 'Andar Bahar Casino', icon: Layers, badge: '96.5% Default', color: 'from-emerald-950/60 to-slate-900 border-emerald-500/30' },
          { id: 'dragon_tiger', label: 'Dragon Tiger Asian', icon: Flame, badge: '96.8% Default', color: 'from-rose-950/60 to-slate-900 border-rose-500/30' },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = activeGame === item.id;
          const gameSetting = settings[item.id] || DEFAULT_RTP_SETTINGS[item.id];

          return (
            <button
              key={item.id}
              onClick={() => {
                soundFx.playClick();
                setActiveGame(item.id as typeof activeGame);
              }}
              className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-b from-indigo-900/60 via-slate-900 to-slate-950 border-indigo-400 shadow-lg shadow-indigo-500/10'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                    isActive ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold ${isActive ? 'text-white' : 'text-slate-300'}`}>
                      {item.label}
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      RTP: <span className="font-mono font-black text-amber-400">{gameSetting.rtpPercentage}%</span> • Edge: <span className="font-mono font-black text-rose-400">{gameSetting.houseEdgePercentage}%</span>
                    </p>
                  </div>
                </div>

                <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border ${
                  gameSetting.isEnabled 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                }`}>
                  {gameSetting.isEnabled ? 'ACTIVE' : 'DISABLED'}
                </span>
              </div>

              {isActive && (
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent mt-3" />
              )}
            </button>
          );
        })}
      </div>

      {/* Main Settings Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: RTP & House Edge Dual Interactive Sliders */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl space-y-6">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white uppercase">
                    RTP & House Edge Calibration
                  </h3>
                  <p className="text-xs text-slate-400">
                    Dual mathematical synchronizer for {currentSetting.gameName}
                  </p>
                </div>
              </div>

              {/* Master Game Toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs font-mono font-bold text-slate-400">Game Status:</span>
                <input
                  type="checkbox"
                  checked={currentSetting.isEnabled}
                  onChange={(e) => {
                    soundFx.playClick();
                    setSettings((prev) => ({
                      ...prev,
                      [activeGame]: { ...prev[activeGame], isEnabled: e.target.checked }
                    }));
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
              </label>
            </div>

            {/* Visual Gauge Comparison */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
                  RTP to Players: {currentSetting.rtpPercentage}%
                </span>
                <span className="text-rose-400 font-bold flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block"></span>
                  Casino House Edge: {currentSetting.houseEdgePercentage}%
                </span>
              </div>

              <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300 relative group"
                  style={{ width: `${currentSetting.rtpPercentage}%` }}
                >
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div 
                  className="h-full bg-gradient-to-r from-rose-500 to-red-600 transition-all duration-300"
                  style={{ width: `${currentSetting.houseEdgePercentage}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>Fair Gaming Safe Zone (&gt;90%)</span>
                <span>High Profit Zone (&gt;10% Edge)</span>
              </div>
            </div>

            {/* RTP Slider & Direct Input */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-200 uppercase flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    Return To Player (RTP %)
                  </label>
                  <p className="text-[11px] text-slate-400">Total expected payout returned to players over time</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="50"
                    max="99.9"
                    step="0.1"
                    value={currentSetting.rtpPercentage}
                    onChange={(e) => handleRtpChange(parseFloat(e.target.value) || 50)}
                    className="w-24 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-right font-mono font-black text-sm text-emerald-400 focus:border-emerald-400 outline-none"
                  />
                  <span className="text-xs font-mono font-bold text-slate-400">%</span>
                </div>
              </div>

              <input
                type="range"
                min="50"
                max="99.9"
                step="0.1"
                value={currentSetting.rtpPercentage}
                onChange={(e) => handleRtpChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />

              <div className="flex justify-between gap-1 text-[10px] font-mono text-slate-500">
                {[80, 85, 90, 95, 96.5, 97.3, 98.5].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handleRtpChange(preset)}
                    className={`px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                      Math.abs(currentSetting.rtpPercentage - preset) < 0.1
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            </div>

            {/* House Edge Slider & Direct Input */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-200 uppercase flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    Casino House Edge %
                  </label>
                  <p className="text-[11px] text-slate-400">Mathematical statistical profit retained by casino</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0.1"
                    max="50"
                    step="0.1"
                    value={currentSetting.houseEdgePercentage}
                    onChange={(e) => handleHouseEdgeChange(parseFloat(e.target.value) || 0.1)}
                    className="w-24 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-right font-mono font-black text-sm text-rose-400 focus:border-rose-400 outline-none"
                  />
                  <span className="text-xs font-mono font-bold text-slate-400">%</span>
                </div>
              </div>

              <input
                type="range"
                min="0.1"
                max="50"
                step="0.1"
                value={currentSetting.houseEdgePercentage}
                onChange={(e) => handleHouseEdgeChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
              />

              <div className="flex justify-between gap-1 text-[10px] font-mono text-slate-500">
                {[1.5, 2.7, 3.5, 5.0, 10.0, 15.0, 20.0].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handleHouseEdgeChange(preset)}
                    className={`px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                      Math.abs(currentSetting.houseEdgePercentage - preset) < 0.1
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* RTP Algorithms & Strategy Modes */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white uppercase">
                  Probability Algorithm Strategy
                </h3>
                <p className="text-xs text-slate-400">Controls how outcomes are generated in live gameplay</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                {
                  id: 'fair_rng',
                  name: 'Natural Fair RNG (Standard)',
                  desc: 'True certified random number generation matching European/Asian physical casino decks/wheel.',
                  icon: Sparkles,
                  color: 'border-indigo-500/30 text-indigo-300'
                },
                {
                  id: 'house_protect',
                  name: 'Dynamic House Protection',
                  desc: 'Real-time table liability sensor. Dynamically minimizes aggregate table payout to guarantee house edge.',
                  icon: ShieldCheck,
                  color: 'border-emerald-500/30 text-emerald-300'
                },
                {
                  id: 'high_house_edge',
                  name: 'Enhanced Margin Optimization',
                  desc: 'Biases outcome slightly against heavy high-roller clusters to maintain high liquidity.',
                  icon: TrendingUp,
                  color: 'border-amber-500/30 text-amber-300'
                },
                {
                  id: 'manual_force',
                  name: 'Manual Result Force Mode',
                  desc: 'Admin manually designates the exact winning number, side, or card for upcoming rounds.',
                  icon: Lock,
                  color: 'border-rose-500/30 text-rose-300'
                }
              ].map((mode) => {
                const Icon = mode.icon;
                const isSelected = currentSetting.rtpMode === mode.id;

                return (
                  <div
                    key={mode.id}
                    onClick={() => {
                      soundFx.playClick();
                      setSettings((prev) => ({
                        ...prev,
                        [activeGame]: { ...prev[activeGame], rtpMode: mode.id as any }
                      }));
                    }}
                    className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-950/40 border-indigo-400 shadow-md'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <Icon className={`w-4 h-4 ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`} />
                      <h4 className={`text-xs font-black uppercase ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                        {mode.name}
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{mode.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Game Betting Limits & Multipliers */}
        <div className="space-y-6">
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Settings2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase">Table Stake Limits</h3>
                <p className="text-[11px] text-slate-400">Min/Max limits per player/side</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">Minimum Bet (₹)</label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={currentSetting.minBet}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 10;
                    setSettings((prev) => ({
                      ...prev,
                      [activeGame]: { ...prev[activeGame], minBet: val }
                    }));
                  }}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-sm text-white focus:border-amber-400 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">Maximum Bet per Side (₹)</label>
                <input
                  type="number"
                  min="100"
                  max="500000"
                  value={currentSetting.maxBet}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 50000;
                    setSettings((prev) => ({
                      ...prev,
                      [activeGame]: { ...prev[activeGame], maxBet: val }
                    }));
                  }}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-sm text-white focus:border-amber-400 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Game Multipliers */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <BarChart2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase">Payout Multipliers</h3>
                <p className="text-[11px] text-slate-400">Active payout coefficients</p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              {activeGame === 'dragon_tiger' && (
                <>
                  <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-red-400 font-bold">🐉 Dragon Win (1:1)</span>
                    <span className="text-amber-400 font-black">{currentSetting.multiplierPrimary || 2.0}x</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-amber-400 font-bold">🐅 Tiger Win (1:1)</span>
                    <span className="text-amber-400 font-black">{currentSetting.multiplierSecondary || 2.0}x</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-emerald-400 font-bold">🟢 Tie Win (8:1)</span>
                    <span className="text-emerald-400 font-black">{currentSetting.multiplierSpecial || 9.0}x</span>
                  </div>
                </>
              )}

              {activeGame === 'andar_bahar' && (
                <>
                  <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-emerald-400 font-bold">🔵 Andar Win (0.95:1)</span>
                    <span className="text-amber-400 font-black">{currentSetting.multiplierPrimary || 1.95}x</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-rose-400 font-bold">🔴 Bahar Win (1:1)</span>
                    <span className="text-amber-400 font-black">{currentSetting.multiplierSecondary || 2.0}x</span>
                  </div>
                </>
              )}

              {activeGame === 'roulette' && (
                <>
                  <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-amber-400 font-bold">🎯 Single Number (Straight)</span>
                    <span className="text-amber-400 font-black">36.0x</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-rose-400 font-bold">🔴 Red / ⚫ Black (1:1)</span>
                    <span className="text-rose-400 font-black">2.0x</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-blue-400 font-bold">📊 Dozen / Column (2:1)</span>
                    <span className="text-blue-400 font-black">3.0x</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Quick Security Badge */}
          <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 text-xs text-indigo-300 flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-white">Firestore Real-time Sync Active</span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                All changes to collection <code className="text-indigo-300 bg-indigo-950 px-1 py-0.5 rounded">game_settings</code> take effect instantly in live gaming client rooms without needing server restart.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
