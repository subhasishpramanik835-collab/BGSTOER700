import React from 'react';
import { Volume2, VolumeX, Bell, Vibrate, Flame, Type, ShieldCheck, Check, ArrowLeft, Settings as SettingsIcon } from 'lucide-react';
import { User, UserSettings } from '../types';
import { soundFx } from '../utils/audio';

interface SettingsViewProps {
  user: User;
  onUpdateSettings: (newSettings: UserSettings) => void;
  onBack?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  onUpdateSettings,
  onBack
}) => {
  const settings: UserSettings = user.settings || {
    bgMusicEnabled: true,
    soundEffectsEnabled: true,
    hapticEnabled: true,
    fireFxEnabled: true,
    fontSize: 'normal'
  };

  const handleToggle = (key: keyof UserSettings) => {
    soundFx.playClick();
    const updated: UserSettings = {
      ...settings,
      [key]: !settings[key]
    };
    onUpdateSettings(updated);
  };

  const handleSetFontSize = (size: 'compact' | 'normal' | 'large') => {
    soundFx.playClick();
    const updated: UserSettings = {
      ...settings,
      fontSize: size
    };
    onUpdateSettings(updated);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6 pb-28">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-amber-500/30 p-6 rounded-3xl shadow-2xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={() => { soundFx.playClick(); onBack(); }}
              className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Go Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <SettingsIcon className="w-6 h-6 animate-spin [animation-duration:12s]" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-amber-500/20 text-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-500/30 font-mono">
                APP PREFERENCES
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black font-mono text-white">System & Game Settings</h1>
            <p className="text-xs text-slate-400 font-mono">Customize sound effects, music, visual fire particles, and font sizing.</p>
          </div>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono">
        
        {/* 1. Background Music */}
        <div className="p-5 bg-slate-900/90 rounded-2xl border border-slate-800 flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl border transition-colors ${
              settings.bgMusicEnabled ?? true
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}>
              {settings.bgMusicEnabled ?? true ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">Background Music</h3>
              <p className="text-[11px] text-slate-400">
                {settings.bgMusicEnabled ?? true ? 'Ambient casino music ON' : 'Background audio muted'}
              </p>
            </div>
          </div>

          <button
            onClick={() => handleToggle('bgMusicEnabled')}
            className={`w-12 h-6 rounded-full transition-all p-0.5 flex items-center cursor-pointer ${
              settings.bgMusicEnabled ?? true ? 'bg-amber-500 justify-end' : 'bg-slate-800 justify-start'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-slate-950 shadow-md"></span>
          </button>
        </div>

        {/* 2. Sound FX */}
        <div className="p-5 bg-slate-900/90 rounded-2xl border border-slate-800 flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl border transition-colors ${
              settings.soundEffectsEnabled ?? true
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}>
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">Game Sound Effects</h3>
              <p className="text-[11px] text-slate-400">
                {settings.soundEffectsEnabled ?? true ? 'Spin, win & button sounds ON' : 'All game audio muted'}
              </p>
            </div>
          </div>

          <button
            onClick={() => handleToggle('soundEffectsEnabled')}
            className={`w-12 h-6 rounded-full transition-all p-0.5 flex items-center cursor-pointer ${
              settings.soundEffectsEnabled ?? true ? 'bg-amber-500 justify-end' : 'bg-slate-800 justify-start'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-slate-950 shadow-md"></span>
          </button>
        </div>

        {/* 3. Haptic Feedback */}
        <div className="p-5 bg-slate-900/90 rounded-2xl border border-slate-800 flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl border transition-colors ${
              settings.hapticEnabled ?? true
                ? 'bg-purple-500/20 text-purple-400 border-purple-500/40'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}>
              <Vibrate className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">Haptic Vibration</h3>
              <p className="text-[11px] text-slate-400">
                {settings.hapticEnabled ?? true ? 'Touch vibration feedback ON' : 'Vibration feedback disabled'}
              </p>
            </div>
          </div>

          <button
            onClick={() => handleToggle('hapticEnabled')}
            className={`w-12 h-6 rounded-full transition-all p-0.5 flex items-center cursor-pointer ${
              settings.hapticEnabled ?? true ? 'bg-amber-500 justify-end' : 'bg-slate-800 justify-start'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-slate-950 shadow-md"></span>
          </button>
        </div>

        {/* 4. Fire & Glow Particle FX */}
        <div className="p-5 bg-slate-900/90 rounded-2xl border border-slate-800 flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl border transition-colors ${
              settings.fireFxEnabled ?? true
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}>
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">Fire & Glow Visual Effects</h3>
              <p className="text-[11px] text-slate-400">
                {settings.fireFxEnabled ?? true ? 'High performance fire particle glow ON' : 'Reduced animations mode'}
              </p>
            </div>
          </div>

          <button
            onClick={() => handleToggle('fireFxEnabled')}
            className={`w-12 h-6 rounded-full transition-all p-0.5 flex items-center cursor-pointer ${
              settings.fireFxEnabled ?? true ? 'bg-amber-500 justify-end' : 'bg-slate-800 justify-start'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-slate-950 shadow-md"></span>
          </button>
        </div>

      </div>

      {/* Font Size Selector Card */}
      <div className="p-6 bg-slate-900/90 rounded-3xl border border-slate-800 space-y-4 font-mono shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 rounded-xl">
            <Type className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-white">Interface Font Size Preference</h3>
            <p className="text-xs text-slate-400">Adjust text size density across the application UI.</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-2">
          {[
            { id: 'compact', label: 'Compact (Small)' },
            { id: 'normal', label: 'Normal (Standard)' },
            { id: 'large', label: 'Large (Bold Display)' }
          ].map((opt) => {
            const isSel = (settings.fontSize || 'normal') === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => handleSetFontSize(opt.id as 'compact' | 'normal' | 'large')}
                className={`py-3 px-4 rounded-2xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                  isSel
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                <span>{opt.label}</span>
                {isSel && <Check className="w-4 h-4 text-slate-950" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Account Sync Banner */}
      <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between text-xs font-mono text-slate-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Preferences automatically synchronized to cloud profile ({user.email}).</span>
        </div>
      </div>

    </div>
  );
};
