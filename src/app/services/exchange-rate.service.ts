import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Currency } from '../models/trip.model';

type RateMap = Record<Currency, number>;

interface FrankfurterRate {
  quote?: string;
  rate?: number;
  date?: string;
}

const STORAGE_KEY = 'tabi-note-exchange-rates-v1';
const API_URL = 'https://api.frankfurter.dev/v2/rates?base=TWD&quotes=JPY,KRW,USD,CNY';
const FALLBACK_RATES: RateMap = { TWD: 1, JPY: 0.22, KRW: 0.024, USD: 32.5, CNY: 4.5 };

@Injectable({ providedIn: 'root' })
export class ExchangeRateService {
  private readonly ratesSubject = new BehaviorSubject<RateMap>(this.loadCachedRates());
  readonly rates$ = this.ratesSubject.asObservable();
  private sourceDate = '';

  constructor() {
    void this.refresh();
  }

  get rates(): RateMap {
    return this.ratesSubject.value;
  }

  get updatedDate(): string {
    return this.sourceDate;
  }

  rateFor(currency: Currency): number {
    return this.rates[currency] ?? FALLBACK_RATES[currency];
  }

  async refresh(): Promise<void> {
    try {
      const response = await fetch(API_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`匯率服務回應 ${response.status}`);
      const rows = await response.json() as FrankfurterRate[];
      const nextRates: RateMap = { ...this.rates, TWD: 1 };
      for (const row of rows) {
        const quote = row.quote as Currency;
        if (quote in nextRates && typeof row.rate === 'number' && row.rate > 0) nextRates[quote] = 1 / row.rate;
        if (row.date) this.sourceDate = row.date;
      }
      this.ratesSubject.next(nextRates);
      this.saveRates(nextRates);
    } catch (error) {
      console.warn('匯率更新失敗，沿用上次快取匯率。', error);
    }
  }

  private loadCachedRates(): RateMap {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return { ...FALLBACK_RATES };
      const parsed = JSON.parse(stored) as { rates?: Partial<RateMap>; date?: string };
      this.sourceDate = parsed.date ?? '';
      return { ...FALLBACK_RATES, ...parsed.rates, TWD: 1 };
    } catch (error) {
      return { ...FALLBACK_RATES };
    }
  }

  private saveRates(rates: RateMap): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ rates, date: this.sourceDate }));
    } catch (error) {
      console.warn('目前瀏覽器無法保存匯率快取。', error);
    }
  }
}
