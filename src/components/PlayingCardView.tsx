import React from 'react';
import { PlayingCard } from '../types';
import { Crown, Sparkles } from 'lucide-react';

interface PlayingCardViewProps {
  card?: PlayingCard;
  isFaceDown?: boolean;
  isWinningCard?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  isNewDealt?: boolean;
}

export const PlayingCardView: React.FC<PlayingCardViewProps> = ({
  card,
  isFaceDown = false,
  isWinningCard = false,
  size = 'md',
  className = '',
  isNewDealt = false,
}) => {
  // Size dimensions
  const sizeClasses = {
    sm: 'w-10 h-14 text-xs rounded-lg',
    md: 'w-16 h-22 sm:w-18 sm:h-26 text-sm rounded-xl',
    lg: 'w-22 h-30 sm:w-26 sm:h-36 text-base rounded-2xl',
    xl: 'w-28 h-40 sm:w-32 sm:h-44 text-lg rounded-2xl',
  };

  if (isFaceDown || !card) {
    return (
      <div
        className={`relative ${sizeClasses[size]} bg-gradient-to-br from-red-900 via-rose-950 to-slate-950 border-2 border-amber-400/80 shadow-xl flex items-center justify-center overflow-hidden transition-all transform select-none ${
          isNewDealt ? 'animate-in zoom-in-50 fade-in duration-300' : ''
        } ${className}`}
      >
        {/* Card Back Royal Pattern */}
        <div className="absolute inset-1 border border-amber-400/40 rounded-lg flex items-center justify-center bg-slate-950/60 overflow-hidden">
          {/* Subtle Diamond Mesh Texture */}
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:8px_8px]" />
          
          <div className="flex flex-col items-center justify-center p-1 text-center">
            <Crown className="w-4 h-4 sm:w-6 sm:h-6 text-amber-400 animate-pulse drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
            <span className="text-[8px] sm:text-[9px] font-black font-mono tracking-widest text-amber-300 mt-0.5">
              BG
            </span>
          </div>
        </div>
      </div>
    );
  }

  const isRed = card.color === 'red';
  const suitSymbol = card.suit === 'hearts' ? '♥' : card.suit === 'diamonds' ? '♦' : card.suit === 'clubs' ? '♣' : '♠';

  return (
    <div
      className={`relative ${sizeClasses[size]} bg-gradient-to-b from-white via-slate-50 to-slate-100 border ${
        isWinningCard 
          ? 'border-amber-400 ring-4 ring-amber-400/70 shadow-[0_0_25px_rgba(245,158,11,0.9)] animate-pulse scale-105 z-20' 
          : 'border-slate-300 shadow-md hover:shadow-lg'
      } flex flex-col justify-between p-1.5 sm:p-2 overflow-hidden transition-all transform select-none ${
        isNewDealt ? 'animate-in zoom-in-75 slide-in-from-top-6 duration-300' : ''
      } ${className}`}
    >
      {/* Winning Badge Overlay */}
      {isWinningCard && (
        <div className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 text-[8px] font-black font-mono px-1 rounded-bl-md shadow-md flex items-center gap-0.5 z-30">
          <Sparkles className="w-2.5 h-2.5" />
          <span>MATCH</span>
        </div>
      )}

      {/* Top Left Rank & Pip */}
      <div className={`flex flex-col items-center leading-none ${isRed ? 'text-rose-600' : 'text-slate-950'}`}>
        <span className="font-black font-mono tracking-tighter text-xs sm:text-sm">{card.rank}</span>
        <span className="text-[11px] sm:text-xs -mt-0.5">{suitSymbol}</span>
      </div>

      {/* Center Main Pip or Face Card Emblem */}
      <div className="flex items-center justify-center my-auto">
        {['J', 'Q', 'K'].includes(card.rank) ? (
          <div className={`flex flex-col items-center ${isRed ? 'text-rose-600' : 'text-slate-900'}`}>
            <Crown className="w-5 h-5 sm:w-7 sm:h-7 drop-shadow-sm opacity-90" />
            <span className="text-[9px] font-black font-mono opacity-75">{card.rank}</span>
          </div>
        ) : (
          <span className={`text-xl sm:text-3xl font-black ${isRed ? 'text-rose-600' : 'text-slate-900'} drop-shadow-sm`}>
            {suitSymbol}
          </span>
        )}
      </div>

      {/* Bottom Right Inverted Rank & Pip */}
      <div className={`flex flex-col items-center leading-none rotate-180 ${isRed ? 'text-rose-600' : 'text-slate-950'}`}>
        <span className="font-black font-mono tracking-tighter text-xs sm:text-sm">{card.rank}</span>
        <span className="text-[11px] sm:text-xs -mt-0.5">{suitSymbol}</span>
      </div>
    </div>
  );
};
