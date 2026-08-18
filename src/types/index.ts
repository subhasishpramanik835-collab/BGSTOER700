export type PaymentMethodType = 'phonepe' | 'gpay' | 'paytm' | 'upi';

export type TransactionStatus = 'pending' | 'approved' | 'rejected';
export type TicketStatus = 'active' | 'win' | 'loss';

export interface UserSettings {
  bgMusicEnabled?: boolean;
  soundEffectsEnabled?: boolean;
  hapticEnabled?: boolean;
  fireFxEnabled?: boolean;
  fontSize?: 'compact' | 'normal' | 'large';
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  balance: number;
  bonusBalance?: number;
  avatarUrl: string;
  regDate: string;
  vipLevel: 'Bronze' | 'Silver' | 'Gold' | 'VIP Platinum';
  vipPoints?: number;
  isVip?: boolean;
  vipExpiryDate?: string;
  referralCode: string;
  totalWon: number;
  totalSpent: number;
  status: 'active' | 'suspended';
  lastSpinTime?: number; // timestamp of last lucky wheel spin
  spinCredits?: number; // available lucky wheel spin credits earned from deposits or gifted by admin
  totalReferrals?: number;
  role?: 'user' | 'admin';
  settings?: UserSettings;
  isSuspicious?: boolean;
  suspiciousReason?: string;
  suspiciousDate?: string;
  linkedDocIds?: string[];
}

export interface WheelSector {
  id: string;
  label: string;
  amount: number;
  color: string;
}

export interface WheelConfig {
  minDepositAmount: number;
  sectors: WheelSector[];
  updatedAt?: string;
}

export interface RegistrationConfig {
  bonusAmount: number;
  isBonusEnabled: boolean;
  duplicateDetectionEnabled: boolean;
  updatedAt?: string;
}

export interface NotificationConfig {
  chimeSoundUrl?: string;
  chimeType?: 'bell' | 'chime' | 'fanfare';
}

export interface BonusBalanceRules {
  allowSuperCar: boolean;          // Default: true (Three Super Car Draw allowed)
  allowRegularLottery: boolean;   // Default: false (Regular Lottery draws locked by default)
  allowLiveRoulette: boolean;     // Default: false (Live Roulette locked by default)
  allowLuckyWheel: boolean;       // Default: false (Lucky Wheel locked by default)
  defaultBonusAmount: number;     // e.g. 100 on registration
  isBonusSystemActive: boolean;  // Master toggle for bonus balance system
  superCarRealTicketPrice?: number; // Configurable real ticket price
  superCarBonusTicketPrice?: number; // Configurable bonus ticket price
  bonusNotice?: string;          // Optional notice/banner text for bonus rules
  updatedAt?: string;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  userEmail?: string;
  type: 'deposit' | 'withdrawal' | 'ticket_buy' | 'win_payout' | 'wheel_bonus' | 'admin_bonus' | 'admin_deduction' | 'roulette_bet' | 'roulette_win' | 'andar_bahar_bet' | 'andar_bahar_win' | 'dragon_tiger_bet' | 'dragon_tiger_win' | 'vip_bonus' | 'loss' | 'win' | 'ticket_win' | 'ticket_loss';
  amount: number;
  description: string;
  status: 'completed' | 'pending' | 'failed' | 'rejected';
  date: string;
  createdAt?: string | number;
  utr?: string;
  walletType?: 'main' | 'bonus';
}

export type BannerCategory = 'lottery' | 'supercar' | 'deposit' | 'offers';

export interface BannerSlide {
  id: string;
  category: BannerCategory;
  title: string;
  subtitle?: string;
  imageUrl: string;
  actionType: 'deposit' | 'supercar' | 'lottery' | 'wheel' | 'roulette' | 'andar_bahar' | 'dragon_tiger' | 'withdrawal' | 'custom_url';
  targetUrl?: string;
  badgeText?: string;
  bgGradient?: string;
  active: boolean;
  order: number;
  orderIndex?: number;
  createdAt?: string;
}

export interface DepositRequest {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  amount: number;
  method: PaymentMethodType;
  utr: string;
  screenshotUrl: string;
  date: string;
  createdAt?: string | number;
  status: TransactionStatus;
  rejectReason?: string;
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  amount: number;
  fullName: string;
  accountNumber: string;
  ifscCode: string;
  upiId: string;
  date: string;
  createdAt?: string | number;
  status: TransactionStatus;
  rejectReason?: string;
}

export interface LotteryScheduleSlot {
  id: string; // e.g. "SCH-4D-20260811-01"
  lotteryId: string; // e.g. "4d-express", "bumper-jackpot", "speed-1m", "supercar", "daily-mega"
  lotteryTitle: string;
  category: string; // '4D Express' | 'Bumper' | 'Speed 1m' | 'Daily Mega' | 'Three Super Card' | custom
  slotName: string;
  drawTimeLabel: string;
  scheduledTimestamp: number; // Unix timestamp in ms
  resultGridsCount: number; // Number of result grids/winning numbers (1 to 10)
  winningResult?: (number | string)[]; // Pre-selected winning result by admin
  prizePool: number;
  ticketPrice: number;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  publishedAt?: string;
  createdAt: string;
  createdByAdmin: string;
}

export interface AdminAuditLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  details: string;
  timestamp: string;
  createdAt: number;
}

export interface LotteryDraw {
  id: string;
  title: string;
  subtitle: string;
  category: 'Bumper' | 'Speed 1m' | 'Daily Mega' | '4D Express';
  ticketPrice: number;
  prizePool: number;
  firstPrize: number;
  secondPrize: number;
  thirdPrize: number;
  endTime: number; // Unix timestamp in ms
  drawDurationMs: number; // duration for auto-reset
  winningNumbers?: number[]; // array of winning digits/numbers
  status: 'upcoming' | 'live' | 'completed';
  totalTicketsSold: number;
  bannerGradient: string;
  badgeText: string;
}

export interface LotteryDrawResult {
  id: string;
  drawId: string;
  title: string;
  category: string;
  winningNumbers: number[];
  firstPrize: number;
  secondPrize?: number;
  thirdPrize?: number;
  date: string;
  createdAt?: string | number;
  totalWinners?: number;
  totalPayout?: number;
  declaredBy?: string;
}

export interface PurchasedTicket {
  id: string;
  batchId?: string;
  userId: string;
  drawId: string;
  drawTitle: string;
  ticketNumber: string; // e.g. "482910" or [4,8,2,9,1,0] or "CAR-RED-8932"
  selectedNumbers: (number | string)[];
  price: number;
  purchaseDate: string;
  purchaseTime?: string;
  drawTime?: number | string;
  drawDate?: string;
  status: TicketStatus;
  wonAmount?: number;
  matchCount?: number;
  selectedCar?: 'red' | 'black' | 'yellow';
  category?: string;
  createdAt?: string;
  slotNum?: number;
  walletType?: 'main' | 'bonus';
}

export type SuperCarColor = 'red' | 'black' | 'yellow';

export interface SuperCarInfo {
  id: SuperCarColor;
  name: string;
  tagline: string;
  image: string;
  accentColor: string;
  glowColor: string;
  badge: string;
  topSpeed: string;
  acceleration: string;
}

export interface SuperCarDrawIssue {
  id: string; // e.g. "CAR-20260809-14"
  issueId: string;
  drawIndex?: number; // 1 to 28
  startTime?: number;
  endTime?: number;
  drawTime?: string;
  status: 'active' | 'shuffling' | 'completed' | 'closed';
  winningCar?: SuperCarColor;
  winnerTicket?: string;
  winnerName?: string;
  prizeText?: string;
  ticketPrice?: number;
  prizeMultiplier?: number;
  totalTicketsSold?: number;
  totalBets?: {
    red: number;
    black: number;
    yellow: number;
  };
  createdAt?: number;
}

export interface SuperCarConfig {
  enabled: boolean;
  ticketPrice: number;
  bonusTicketPrice?: number;
  allowBonusPurchase?: boolean;
  prizeMultiplier: number;
  resultMode: 'auto' | 'manual';
  manualWinner?: SuperCarColor;
  operatingStartHour: number; // 8 (08:00 AM)
  operatingEndHour: number;   // 22 (10:00 PM)
  drawIntervalMinutes: number; // 30 or 10
  carImages?: {
    red?: string;
    black?: string;
    yellow?: string;
  };
  carPrices?: {
    red?: number;
    black?: number;
    yellow?: number;
  };
  bonusCarPrices?: {
    red?: number;
    black?: number;
    yellow?: number;
  };
  carMultipliers?: {
    red?: number;
    black?: number;
    yellow?: number;
  };
  lockedSlots?: number[]; // array of slot indices locked by admin
  manualSlotWinners?: Record<number | string, SuperCarColor>; // manual winner per slot index 1..84 or issueId
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'deposit' | 'withdrawal' | 'win' | 'loss' | 'system';
  date: string;
  read: boolean;
  createdAt?: number;
  isCritical?: boolean;
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  onlineUsers: number;
  totalDeposits: number;
  totalWithdrawals: number;
  pendingDepositsCount: number;
  pendingWithdrawalsCount: number;
  totalRevenue: number;
  totalPayouts: number;
}

export interface PaymentConfig {
  upiId: string;
  qrCodeUrl: string;
  accountName: string;
  minDeposit: number;
  maxDeposit: number;
  instructions: string;
  updatedAt?: string;
}

export type RouletteRtpMode = 'european_standard' | 'dynamic_rtp' | 'house_protect' | 'manual_next_number';

export interface RouletteConfig {
  rtpPercentage: number; // e.g. 97.3, 90, 85, 80, 70
  houseEdgePercentage: number; // e.g. 2.7, 10, 15, 20, 30
  rtpMode: RouletteRtpMode;
  manualNextNumber?: number; // 0 to 36
  manualNextNumberActive?: boolean;
  minBet: number;
  maxBet: number;
  maxTotalPayoutLimit?: number;
  isRouletteEnabled: boolean;
  lastUpdated?: string;
  updatedBy?: string;
}

export type CardSuit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type CardRank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface PlayingCard {
  id: string;
  suit: CardSuit;
  rank: CardRank;
  value: number; // 1 to 13 (A=1, 2=2, ..., K=13)
  color: 'red' | 'black';
}

export type AndarBaharSide = 'andar' | 'bahar';

export interface AndarBaharRound {
  id: string; // e.g. "AB-20260814-1001"
  roundNumber: number;
  jokerCard: PlayingCard;
  andarCards: PlayingCard[];
  baharCards: PlayingCard[];
  winningSide?: AndarBaharSide;
  winningCard?: PlayingCard;
  totalCardsDealt: number;
  status: 'betting' | 'dealing' | 'completed' | 'cancelled';
  startTime: number;
  endTime?: number;
  totalBetsAndar: number;
  totalBetsBahar: number;
  totalPayout: number;
  createdAt: string;
}

export interface AndarBaharBet {
  id: string;
  roundId: string;
  userId: string;
  userName: string;
  userPhone?: string;
  side: AndarBaharSide;
  amount: number;
  payoutMultiplier: number;
  wonAmount?: number;
  status: 'pending' | 'won' | 'lost';
  createdAt: string;
  timestamp: number;
}

export type AndarBaharRtpMode = 'fair_rng' | 'house_protect' | 'manual_force_winner';

export interface AndarBaharConfig {
  isEnabled: boolean;
  minBet: number;
  maxBet: number;
  bettingDurationSeconds: number; // e.g. 15 to 30
  dealingSpeedMs: number; // e.g. 400 to 1000
  andarMultiplier: number; // e.g. 1.95 (0.95:1)
  baharMultiplier: number; // e.g. 1.95 or 2.0
  rtpMode: AndarBaharRtpMode;
  manualForceWinner?: AndarBaharSide | 'random';
  manualJokerRank?: CardRank | 'random';
  updatedAt?: string;
  updatedBy?: string;
}

export type DragonTigerSide = 'dragon' | 'tiger' | 'tie';

export interface DragonTigerRound {
  id: string; // e.g. "DT-20260814-1001"
  roundNumber: number;
  dragonCard?: PlayingCard;
  tigerCard?: PlayingCard;
  winningSide?: DragonTigerSide;
  status: 'betting' | 'dealing' | 'completed' | 'cancelled';
  startTime: number;
  endTime?: number;
  totalBetsDragon: number;
  totalBetsTiger: number;
  totalBetsTie: number;
  totalPayout: number;
  createdAt: string;
}

export interface DragonTigerBet {
  id: string;
  roundId: string;
  userId: string;
  userName: string;
  userPhone?: string;
  side: DragonTigerSide;
  amount: number;
  payoutMultiplier: number;
  wonAmount?: number;
  status: 'pending' | 'won' | 'lost' | 'tie_push';
  createdAt: string;
  timestamp: number;
}

export type DragonTigerRtpMode = 'fair_rng' | 'house_protect' | 'manual_force_winner';

export interface DragonTigerConfig {
  isEnabled: boolean;
  minBet: number;
  maxBet: number;
  bettingDurationSeconds: number; // e.g. 15 to 30
  dragonMultiplier: number; // e.g. 2.0 (1:1)
  tigerMultiplier: number; // e.g. 2.0 (1:1)
  tieMultiplier: number; // e.g. 9.0 (8:1)
  rtpPercentage?: number;
  houseEdgePercentage?: number;
  rtpMode: DragonTigerRtpMode;
  manualForceWinner?: DragonTigerSide | 'random';
  manualDragonRank?: CardRank | 'random';
  manualTigerRank?: CardRank | 'random';
  updatedAt?: string;
  updatedBy?: string;
}

export interface LiveGameRtpSettings {
  id: 'roulette' | 'andar_bahar' | 'dragon_tiger' | 'global';
  gameName: string;
  rtpPercentage: number; // e.g. 97.3, 96.5, 96.8
  houseEdgePercentage: number; // 100 - rtpPercentage or custom set
  rtpMode: 'fair_rng' | 'house_protect' | 'high_house_edge' | 'custom_rtp' | 'manual_force';
  manualForceTarget?: string;
  manualForceActive?: boolean;
  minBet: number;
  maxBet: number;
  isEnabled: boolean;
  targetProfitMargin?: number;
  multiplierPrimary?: number;
  multiplierSecondary?: number;
  multiplierSpecial?: number;
  notes?: string;
  updatedAt: string;
  updatedBy: string;
}

