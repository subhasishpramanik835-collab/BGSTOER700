import { User, LotteryDraw, DepositRequest, WithdrawalRequest, PurchasedTicket, WalletTransaction, NotificationItem } from '../types';
import { INITIAL_USER, INITIAL_DRAWS, INITIAL_DEPOSITS, INITIAL_WITHDRAWALS, INITIAL_TICKETS, INITIAL_TRANSACTIONS, INITIAL_NOTIFICATIONS } from '../data/mockData';

const KEYS = {
  USER: 'betguru_user',
  DRAWS: 'betguru_draws',
  DEPOSITS: 'betguru_deposits',
  WITHDRAWALS: 'betguru_withdrawals',
  TICKETS: 'betguru_tickets',
  TRANSACTIONS: 'betguru_transactions',
  NOTIFICATIONS: 'betguru_notifications'
};

export const loadState = () => {
  try {
    const user = localStorage.getItem(KEYS.USER) ? JSON.parse(localStorage.getItem(KEYS.USER)!) : INITIAL_USER;
    const draws = localStorage.getItem(KEYS.DRAWS) ? JSON.parse(localStorage.getItem(KEYS.DRAWS)!) : INITIAL_DRAWS;
    const deposits = localStorage.getItem(KEYS.DEPOSITS) ? JSON.parse(localStorage.getItem(KEYS.DEPOSITS)!) : INITIAL_DEPOSITS;
    const withdrawals = localStorage.getItem(KEYS.WITHDRAWALS) ? JSON.parse(localStorage.getItem(KEYS.WITHDRAWALS)!) : INITIAL_WITHDRAWALS;
    const tickets = localStorage.getItem(KEYS.TICKETS) ? JSON.parse(localStorage.getItem(KEYS.TICKETS)!) : INITIAL_TICKETS;
    const transactions = localStorage.getItem(KEYS.TRANSACTIONS) ? JSON.parse(localStorage.getItem(KEYS.TRANSACTIONS)!) : INITIAL_TRANSACTIONS;
    const notifications = localStorage.getItem(KEYS.NOTIFICATIONS) ? JSON.parse(localStorage.getItem(KEYS.NOTIFICATIONS)!) : INITIAL_NOTIFICATIONS;

    return { user, draws, deposits, withdrawals, tickets, transactions, notifications };
  } catch (e) {
    console.error('Failed to load state from localStorage', e);
    return {
      user: INITIAL_USER,
      draws: INITIAL_DRAWS,
      deposits: INITIAL_DEPOSITS,
      withdrawals: INITIAL_WITHDRAWALS,
      tickets: INITIAL_TICKETS,
      transactions: INITIAL_TRANSACTIONS,
      notifications: INITIAL_NOTIFICATIONS
    };
  }
};

export const saveState = (state: {
  user?: User;
  draws?: LotteryDraw[];
  deposits?: DepositRequest[];
  withdrawals?: WithdrawalRequest[];
  tickets?: PurchasedTicket[];
  transactions?: WalletTransaction[];
  notifications?: NotificationItem[];
}) => {
  try {
    if (state.user) localStorage.setItem(KEYS.USER, JSON.stringify(state.user));
    if (state.draws) localStorage.setItem(KEYS.DRAWS, JSON.stringify(state.draws));
    if (state.deposits) localStorage.setItem(KEYS.DEPOSITS, JSON.stringify(state.deposits));
    if (state.withdrawals) localStorage.setItem(KEYS.WITHDRAWALS, JSON.stringify(state.withdrawals));
    if (state.tickets) localStorage.setItem(KEYS.TICKETS, JSON.stringify(state.tickets));
    if (state.transactions) localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(state.transactions));
    if (state.notifications) localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(state.notifications));
  } catch (e) {
    console.error('Failed to save state to localStorage', e);
  }
};
