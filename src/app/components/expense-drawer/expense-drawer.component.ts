import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Expense, Trip, TripEvent, TripMember } from '../../models/trip.model';

const categoryIcons: Record<string, string> = { 餐飲: '🍜', 交通: '🚆', 住宿: '🏨', 門票: '🎫', 購物: '🛍️', 其他: '📝' };

@Component({
  selector: 'app-expense-drawer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './expense-drawer.component.html'
})
export class ExpenseDrawerComponent {
  @Input() trip: Trip | null = null;
  @Input() currentUserId: string | null = null;
  @Input() open = false;
  @Output() readonly close = new EventEmitter<void>();
  @Output() readonly addExpense = new EventEmitter<void>();
  @Output() readonly editExpense = new EventEmitter<Expense>();
  @Output() readonly editEvent = new EventEmitter<TripEvent>();

  get expenses(): Expense[] {
    return this.trip?.expenses ?? [];
  }

  get members(): TripMember[] {
    if (!this.trip) return [];
    const members = this.trip.members?.length
      ? [...this.trip.members]
      : [{ uid: this.trip.ownerId ?? this.currentUserId ?? 'owner', displayName: this.trip.nickname || '建立者', photoURL: null }];
    if (this.currentUserId && !members.some((member) => member.uid === this.currentUserId)) {
      return [{ uid: this.currentUserId, displayName: '我', photoURL: null }, ...members];
    }
    return members;
  }

  get paidEvents(): TripEvent[] {
    const linkedEventIds = new Set(this.expenses.map((expense) => expense.linkedEventId).filter((id): id is string => Boolean(id)));
    return (this.trip?.days.flatMap((day) => day.events) ?? []).filter((event) =>
      event.paymentStatus === 'paid'
      && this.eventAmountTwd(event) > 0
      && !linkedEventIds.has(event.id)
    );
  }

  get recordCount(): number {
    return this.expenses.length + this.paidEvents.length;
  }

  get total(): number {
    return this.expenses.reduce((sum, expense) => sum + this.amountTwd(expense), 0)
      + this.paidEvents.reduce((sum, event) => sum + this.eventAmountTwd(event), 0);
  }

  get settlement(): number {
    const currentUser = this.currentUserId ?? this.members[0]?.uid;
    return this.settlements.find((settlement) => settlement.member.uid === currentUser)?.balance ?? 0;
  }

  get settlements(): Array<{ member: TripMember; balance: number }> {
    const balances = new Map(this.members.map((member) => [member.uid, 0]));
    for (const expense of this.expenses) {
      const payerId = this.resolvePayerId(expense);
      if (!payerId) continue;
      balances.set(payerId, (balances.get(payerId) ?? 0) + this.amountTwd(expense));
      if (expense.split === 'custom') {
        const rate = expense.currency && expense.currency !== 'TWD' ? expense.exchangeRate ?? 0 : 1;
        const memberIds = new Set(this.members.map((member) => member.uid));
        for (const [participantId, amount] of Object.entries(expense.participantAmounts ?? {})) {
          if (memberIds.has(participantId) && amount > 0) balances.set(participantId, (balances.get(participantId) ?? 0) - amount * rate);
        }
      } else {
        const participants = this.participantIds(expense);
        if (!participants.length) continue;
        const share = this.amountTwd(expense) / participants.length;
        for (const participantId of participants) {
          balances.set(participantId, (balances.get(participantId) ?? 0) - share);
        }
      }
    }
    return this.members.map((member) => ({ member, balance: balances.get(member.uid) ?? 0 }));
  }

  get summaryText(): string {
    if (this.recordCount === 0) return '還沒有支出紀錄';
    const balanceText = Math.abs(this.settlement) < 0.01
      ? '目前已結清'
      : this.settlement > 0
        ? `${this.members.length > 2 ? '其他旅伴合計需給我' : '旅伴需給我'} ${this.formatMoney(this.settlement)}`
        : `我需給旅伴 ${this.formatMoney(-this.settlement)}`;
    return this.paidEvents.length > 0 ? `${balanceText} · 行程付款未列入分帳` : balanceText;
  }

  categoryIcon(category: string): string {
    return categoryIcons[category] ?? '📝';
  }

  formatMoney(amount: number): string {
    return `NT$${amount.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}`;
  }

  formatOriginalMoney(amount: number, currency: string | undefined): string {
    const symbols: Record<string, string> = { JPY: '¥', KRW: '₩', USD: '$', CNY: '¥', TWD: 'NT$' };
    return `${symbols[currency ?? 'JPY'] ?? currency ?? ''}${amount.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}`;
  }

  formatEventMoney(event: TripEvent): string {
    return this.formatOriginalMoney(event.paymentAmount ?? 0, event.paymentCurrency ?? undefined);
  }

  eventAmountTwd(event: TripEvent): number {
    if (typeof event.paymentAmountTwd === 'number') return event.paymentAmountTwd;
    if (event.paymentCurrency && event.paymentCurrency !== 'TWD' && typeof event.paymentExchangeRate === 'number') return (event.paymentAmount ?? 0) * event.paymentExchangeRate;
    return event.paymentAmount ?? 0;
  }

  amountTwd(expense: Expense): number {
    if (typeof expense.amountTwd === 'number') return expense.amountTwd;
    if (expense.currency && expense.currency !== 'TWD' && typeof expense.exchangeRate === 'number') return expense.amount * expense.exchangeRate;
    return expense.amount;
  }

  formatDate(date: string): string {
    if (!date || date === '今天') return date;
    return date.slice(5).replace('-', '/');
  }

  linkedEventTitle(expense: Expense): string | null {
    if (!expense.linkedEventId) return null;
    for (const day of this.trip?.days ?? []) {
      const event = day.events.find((candidate) => candidate.id === expense.linkedEventId);
      if (event) return event.title;
    }
    return null;
  }

  payerName(expense: Expense): string {
    const payerId = this.resolvePayerId(expense);
    return this.members.find((member) => member.uid === payerId)?.displayName ?? expense.payer;
  }

  splitDescription(expense: Expense): string {
    if (expense.split === 'payer') return '付款人負擔';
    if (expense.split === 'custom') return `${this.participantIds(expense).length} 人自訂分帳`;
    return `${this.participantIds(expense).length} 人分攤`;
  }

  settlementDescription(balance: number): string {
    if (Math.abs(balance) < 0.01) return '已結清';
    return balance > 0 ? `應收 ${this.formatMoney(balance)}` : `應付 ${this.formatMoney(-balance)}`;
  }

  private resolvePayerId(expense: Expense): string {
    const memberIds = this.members.map((member) => member.uid);
    if (expense.payerId && memberIds.includes(expense.payerId)) return expense.payerId;
    if (expense.payer === '我' && this.currentUserId && memberIds.includes(this.currentUserId)) return this.currentUserId;
    if (expense.payer === '旅伴') return memberIds.find((id) => id !== this.currentUserId) ?? memberIds[0] ?? '';
    return memberIds[0] ?? '';
  }

  private participantIds(expense: Expense): string[] {
    const memberIds = new Set(this.members.map((member) => member.uid));
    if (expense.split === 'custom') return Object.keys(expense.participantAmounts ?? {}).filter((id) => memberIds.has(id));
    const savedIds = expense.participantIds?.filter((id) => memberIds.has(id)) ?? [];
    if (savedIds.length) return savedIds;
    if (expense.split === 'payer') return [this.resolvePayerId(expense)];
    return [...memberIds];
  }
}
