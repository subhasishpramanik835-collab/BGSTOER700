import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, ExternalLink, Zap, Gift, Trophy, Wallet, ShieldCheck } from 'lucide-react';
import { BannerSlide, BannerCategory } from '../types';

interface PromotionalSliderProps {
  category?: BannerCategory;
  slides?: BannerSlide[];
  title?: string;
  onAction?: (actionType: string, targetUrl?: string) => void;
}

// Fallback Default Banner Slides for each Category
export const DEFAULT_BANNER_SLIDES: BannerSlide[] = [
  // 1. Super Car Slides
  {
    id: 'default-dragon-tiger-1',
    category: 'supercar',
    title: '🐉 Live Dragon Tiger Asian Classic',
    subtitle: 'Bet Dragon or Tiger with 2.0x instant payout and 9.0x on Tie! Real dealer action.',
    imageUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=1200&q=80',
    actionType: 'dragon_tiger',
    badgeText: 'HOT CASINO',
    bgGradient: 'from-red-950/90 via-slate-950/90 to-amber-950',
    active: true,
    order: 1
  },
  {
    id: 'default-andar-bahar-1',
    category: 'supercar',
    title: '🎴 Live Andar Bahar HD Card Casino',
    subtitle: 'Match the Joker Card on Andar or Bahar for instant 2.0x real cash payouts!',
    imageUrl: 'https://images.unsplash.com/photo-1511193311914-0346f16efe90?auto=format&fit=crop&w=1200&q=80',
    actionType: 'andar_bahar',
    badgeText: 'HOT CASINO',
    bgGradient: 'from-emerald-900/90 via-slate-950/90 to-amber-950',
    active: true,
    order: 2
  },
  {
    id: 'default-supercar-1',
    category: 'supercar',
    title: '🏎️ 3 Super Car Live VIP Jackpot',
    subtitle: 'Win 2.8x instant payout every 10 minutes on Red, Black or Yellow Super Cars!',
    imageUrl: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=1200&q=80',
    actionType: 'supercar',
    badgeText: '2.8x MULTIPLIER',
    bgGradient: 'from-amber-600/90 via-red-900/80 to-slate-950',
    active: true,
    order: 2
  },
  {
    id: 'default-supercar-2',
    category: 'supercar',
    title: '⚡ 10-Minute Rapid Slot Rotations',
    subtitle: 'Over ₹2,80,000 in active draw pools! Pick your lucky car slot now.',
    imageUrl: 'https://images.unsplash.com/photo-1544829099-b9a0c07fad1a?auto=format&fit=crop&w=1200&q=80',
    actionType: 'supercar',
    badgeText: 'LIVE DRAW',
    bgGradient: 'from-purple-900/90 via-slate-900/90 to-amber-950',
    active: true,
    order: 2
  },
  {
    id: 'default-live-casino-1',
    category: 'supercar',
    title: '🎡 Live VIP Lucky Wheel & Spin Bonus',
    subtitle: 'Deposit ₹1,000+ to unlock VIP Spin Credits & Win up to ₹5,000 Cash Multipliers!',
    imageUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=1200&q=80',
    actionType: 'wheel',
    badgeText: 'LIVE VIP WHEEL',
    bgGradient: 'from-amber-600/90 via-purple-950/90 to-slate-950',
    active: true,
    order: 3
  },

  // 2. Lottery Slides
  {
    id: 'default-lottery-1',
    category: 'lottery',
    title: '🎟️ 4D Express & Mega Bumper Draws',
    subtitle: 'Match 4 lucky digits to win the ₹2,50,000 Grand Bumper Prize pool!',
    imageUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=1200&q=80',
    actionType: 'lottery',
    badgeText: 'GRAND BUMPER',
    bgGradient: 'from-amber-500/90 via-yellow-900/80 to-slate-950',
    active: true,
    order: 1
  },
  {
    id: 'default-lottery-2',
    category: 'lottery',
    title: '🌟 Daily Speed 1-Min Lottery',
    subtitle: 'Tickets starting at just ₹10 with 100% transparent live draw results!',
    imageUrl: 'https://images.unsplash.com/photo-1511193311914-0346f16efe90?auto=format&fit=crop&w=1200&q=80',
    actionType: 'lottery',
    badgeText: 'FASTEST DRAW',
    bgGradient: 'from-emerald-800/90 via-teal-900/80 to-slate-950',
    active: true,
    order: 2
  },

  // 3. Deposit Offers Slides
  {
    id: 'default-deposit-1',
    category: 'deposit',
    title: '💰 100% Instant First Deposit Bonus',
    subtitle: 'Deposit ₹500 or more via PhonePe, GPay or PayTM & get 100% extra cash bonus!',
    imageUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80',
    actionType: 'deposit',
    badgeText: 'DOUBLE CASH',
    bgGradient: 'from-emerald-600/90 via-green-950/90 to-slate-950',
    active: true,
    order: 1
  },
  {
    id: 'default-deposit-2',
    category: 'deposit',
    title: '🚀 0% Processing Fee UPI & QR Code',
    subtitle: 'Instant automatic payment verification available 24/7 with zero waiting time.',
    imageUrl: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=1200&q=80',
    actionType: 'deposit',
    badgeText: '24/7 INSTANT',
    bgGradient: 'from-cyan-800/90 via-blue-950/90 to-slate-950',
    active: true,
    order: 2
  },

  // 4. Special Offers Slides
  {
    id: 'default-offers-1',
    category: 'offers',
    title: '🎡 Daily Free Lucky Wheel Spin',
    subtitle: 'Spin the fortune wheel every 24 hours to win up to ₹1,000 free bonus cash!',
    imageUrl: 'https://images.unsplash.com/photo-1596838132731-3301c3fd4317?auto=format&fit=crop&w=1200&q=80',
    actionType: 'wheel',
    badgeText: 'FREE DAILY CASH',
    bgGradient: 'from-purple-800/90 via-pink-950/90 to-slate-950',
    active: true,
    order: 1
  },
  {
    id: 'default-offers-2',
    category: 'offers',
    title: '🎁 Refer Friends & Earn ₹500 Bonus',
    subtitle: 'Get lifetime commission and ₹500 cash for every friend who joins BETGURU!',
    imageUrl: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1200&q=80',
    actionType: 'deposit',
    badgeText: 'REFERRAL PERKS',
    bgGradient: 'from-amber-600/90 via-yellow-900/90 to-slate-950',
    active: true,
    order: 2
  }
];

export const PromotionalSlider: React.FC<PromotionalSliderProps> = ({
  category,
  slides,
  title,
  onAction
}) => {
  // Filter active slides matching current category if provided, or all active slides
  const filtered = (slides || []).filter((s) => (!category || s.category === category) && s.active);
  const activeSlides = filtered.length > 0
    ? filtered.sort((a, b) => a.order - b.order)
    : (category ? DEFAULT_BANNER_SLIDES.filter((s) => s.category === category) : DEFAULT_BANNER_SLIDES);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (activeSlides.length <= 1 || isHovered) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeSlides.length);
    }, 4500);

    return () => clearInterval(timer);
  }, [activeSlides.length, isHovered]);

  if (activeSlides.length === 0) return null;

  const currentSlide = activeSlides[currentIndex % activeSlides.length];

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + activeSlides.length) % activeSlides.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % activeSlides.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        // Swipe left -> Next
        setCurrentIndex((prev) => (prev + 1) % activeSlides.length);
      } else {
        // Swipe right -> Prev
        setCurrentIndex((prev) => (prev - 1 + activeSlides.length) % activeSlides.length);
      }
    }
    touchStartX.current = null;
  };

  const getActionLabel = (actionType: string) => {
    switch (actionType) {
      case 'deposit': return 'Deposit Now';
      case 'supercar': return 'Play Super Car';
      case 'lottery': return 'Buy Lottery Ticket';
      case 'wheel': return 'Spin Wheel';
      case 'roulette': return 'Play Roulette';
      case 'andar_bahar': return 'Play Andar Bahar';
      case 'withdrawal': return 'Withdraw Cash';
      default: return 'Claim Offer';
    }
  };

  return (
    <div className="space-y-2">
      {title && (
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black text-amber-400 tracking-wider uppercase flex items-center gap-1.5 font-mono">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>{title}</span>
          </h3>
          <span className="text-[10px] text-slate-400 font-mono font-semibold">
            {currentIndex + 1} / {activeSlides.length}
          </span>
        </div>
      )}

      {/* Main Animated Banner Card */}
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={() => onAction?.(currentSlide.actionType, currentSlide.targetUrl)}
        className="relative w-full h-44 sm:h-52 rounded-2xl overflow-hidden cursor-pointer shadow-xl border border-amber-500/20 group transition-all duration-300 hover:border-amber-400/50"
      >
        {/* Background HD Image */}
        <img
          src={currentSlide.imageUrl}
          alt={currentSlide.title}
          className="absolute inset-0 w-full h-full object-cover transform scale-105 transition-transform duration-700 ease-out group-hover:scale-110"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=1200&q=80';
          }}
        />

        {/* Gradient Overlay */}
        <div className={`absolute inset-0 bg-gradient-to-r ${currentSlide.bgGradient || 'from-slate-950/95 via-slate-950/80 to-transparent'}`}></div>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/30"></div>

        {/* Content Overlay */}
        <div className="absolute inset-0 p-4 sm:p-5 flex flex-col justify-between z-10">
          
          {/* Top Badge & Promo Tag */}
          <div className="flex items-center justify-between">
            {currentSlide.badgeText ? (
              <span className="px-2.5 py-1 bg-amber-500 text-slate-950 font-black text-[10px] tracking-wider rounded-lg uppercase shadow-lg shadow-amber-500/30 flex items-center gap-1 font-mono">
                <Zap className="w-3 h-3 fill-slate-950" />
                <span>{currentSlide.badgeText}</span>
              </span>
            ) : (
              <span className="px-2.5 py-1 bg-slate-900/80 backdrop-blur-md text-amber-300 font-bold text-[10px] rounded-lg border border-amber-500/30 font-mono">
                SPECIAL PROMO
              </span>
            )}

            <div className="p-1.5 bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-full text-slate-300 group-hover:text-amber-400 group-hover:border-amber-400 transition-colors">
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Middle Headline & Subtitle */}
          <div className="space-y-1 max-w-md">
            <h2 className="text-base sm:text-lg font-black text-white leading-tight drop-shadow-md font-mono">
              {currentSlide.title}
            </h2>
            {currentSlide.subtitle && (
              <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed opacity-90 drop-shadow">
                {currentSlide.subtitle}
              </p>
            )}
          </div>

          {/* Bottom Action Button & Pagination */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAction?.(currentSlide.actionType, currentSlide.targetUrl);
              }}
              className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all transform active:scale-95 flex items-center gap-1.5 font-mono"
            >
              <span>{getActionLabel(currentSlide.actionType)}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Pagination Dots */}
            {activeSlides.length > 1 && (
              <div className="flex items-center gap-1.5 bg-slate-950/70 backdrop-blur-md px-2.5 py-1 rounded-full border border-slate-800">
                {activeSlides.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentIndex(idx);
                    }}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      idx === currentIndex ? 'w-5 bg-amber-400' : 'w-1.5 bg-slate-600 hover:bg-slate-400'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Left/Right Navigation Arrows for Desktop/Large screen */}
        {activeSlides.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-slate-950/70 hover:bg-slate-900 border border-slate-700 text-slate-200 hover:text-amber-400 transition-all opacity-0 group-hover:opacity-100 z-20"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-slate-950/70 hover:bg-slate-900 border border-slate-700 text-slate-200 hover:text-amber-400 transition-all opacity-0 group-hover:opacity-100 z-20"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
