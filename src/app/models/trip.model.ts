export type EventPriority = "must" | "if-time";
export type ReservationStatus = "booked" | "to-book";
export type PaymentStatus = "paid" | "unpaid";
export type Currency = "JPY" | "KRW" | "USD" | "CNY" | "TWD";
export type ExpensePayer = "我" | "旅伴";
export type ExpenseSplit = "half" | "payer" | "custom";

export interface TripEvent {
  id: string;
  time: string;
  title: string;
  note: string;
  category: string;
  priority: EventPriority;
  createdBy?: string;
  mapsUrl: string;
  reservationStatus?: ReservationStatus | null;
  paymentStatus?: PaymentStatus | null;
  paymentAmount?: number | null;
  paymentCurrency?: Currency | null;
  paymentExchangeRate?: number | null;
  paymentAmountTwd?: number | null;
}

export interface TripDay {
  id: string;
  date: string;
  label: string;
  title: string;
  events: TripEvent[];
  note?: string;
}

export interface TripFlight {
  id: string;
  airline: string;
  flightNumber: string;
  departure: string;
  arrival: string;
  departureAt: string;
  arrivalAt: string;
  note: string;
}

export interface TripHotel {
  id: string;
  name: string;
  address: string;
  checkIn: string;
  checkOut: string;
  note: string;
  mapsUrl: string;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  payer: ExpensePayer;
  split: ExpenseSplit;
  payerId?: string | null;
  participantIds?: string[];
  participantAmounts?: Record<string, number>;
  date: string;
  currency?: Currency;
  exchangeRate?: number | null;
  amountTwd?: number | null;
  linkedEventId?: string | null;
}

export const OPTION_KINDS = ["正餐", "輕食", "逛街", "景點"] as const;
export type OptionKind = (typeof OPTION_KINDS)[number];
export const OPTION_KIND_ICONS: Record<OptionKind, string> = {
  正餐: "🍽️",
  輕食: "🍰",
  逛街: "🛍️",
  景點: "📍",
};

export interface TripOption {
  id: string;
  title: string;
  note: string;
  mapsUrl: string;
  kind?: OptionKind;
  createdBy?: string;
}

export interface TripMember {
  uid: string;
  displayName: string;
  photoURL?: string | null;
}

export interface Trip {
  id: string;
  icon: string;
  nickname: string;
  ownerId?: string | null;
  memberIds?: string[];
  members?: TripMember[];
  inviteCode?: string;
  name: string;
  city: string;
  startDate: string;
  endDate: string;
  flights?: TripFlight[];
  hotels?: TripHotel[];
  days: TripDay[];
  expenses: Expense[];
  options: TripOption[];
}

export interface TripState {
  activeTripId: string | null;
  activeDayId: string | null;
  trips: Trip[];
}

export interface CreateTripInput {
  name: string;
  city: string;
  startDate: string;
  endDate: string;
  flights?: TripFlight[];
  hotels?: TripHotel[];
}

export interface CreateEventInput {
  time: string;
  title: string;
  note: string;
  category: string;
  priority: EventPriority;
  mapsUrl: string;
  reservationStatus?: ReservationStatus | null;
  paymentStatus?: PaymentStatus | null;
  paymentAmount?: number | null;
  paymentCurrency?: Currency | null;
  paymentExchangeRate?: number | null;
  paymentAmountTwd?: number | null;
}

export interface CreateExpenseInput {
  title: string;
  amount: number;
  category: string;
  payer: ExpensePayer;
  split: ExpenseSplit;
  payerId?: string | null;
  participantIds?: string[];
  participantAmounts?: Record<string, number>;
  currency: Currency;
  exchangeRate?: number | null;
  amountTwd: number;
  date?: string;
  linkedEventId?: string | null;
}

export interface CreateTripOptionInput {
  title: string;
  note: string;
  mapsUrl: string;
  kind: OptionKind;
}
