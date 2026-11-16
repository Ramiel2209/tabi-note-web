import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CreateEventInput, Currency, EventPriority, PaymentStatus, ReservationStatus, TripEvent } from '../../models/trip.model';
import { ExchangeRateService } from '../../services/exchange-rate.service';

@Component({
  selector: 'app-event-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './event-dialog.component.html'
})
export class EventDialogComponent implements OnChanges, OnDestroy {
  @Input() event: TripEvent | null = null;
  @Input() initialValues: Partial<CreateEventInput> | null = null;
  @Input() transportOnly = false;
  @Input() open = false;
  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly saved = new EventEmitter<CreateEventInput>();
  private readonly formBuilder = inject(FormBuilder);
  private readonly exchangeRates = inject(ExchangeRateService);
  readonly form = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(60)]],
    time: ['', Validators.required],
    category: ['', Validators.required],
    priority: ['', Validators.required],
    reservationStatus: [''],
    paymentStatus: [''],
    paymentAmount: [''],
    paymentCurrency: ['JPY'],
    paymentExchangeRate: [''],
    note: ['', Validators.maxLength(160)],
    mapsUrl: ['', Validators.pattern(/^\s*https?:\/\/\S+\s*$/i)]
  });
  private readonly ratesSubscription = this.exchangeRates.rates$.subscribe(() => {
    if (!this.open || this.event || this.form.controls.paymentCurrency.value === 'TWD' || this.form.controls.paymentExchangeRate.dirty) return;
    this.form.controls.paymentExchangeRate.setValue(String(this.exchangeRates.rateFor(this.form.controls.paymentCurrency.value as Currency)), { emitEvent: false });
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true) {
      const source = this.event ?? this.initialValues;
      const paymentCurrency = source?.paymentCurrency ?? 'JPY';
      this.form.reset({
        title: source?.title ?? '',
        time: source?.time ?? (this.isTransportDialog ? '12:00' : ''),
        category: source?.category ?? (this.isTransportDialog ? '交通' : ''),
        priority: source?.priority ?? (this.isTransportDialog ? 'if-time' : ''),
        reservationStatus: source?.reservationStatus ?? '',
        paymentStatus: source?.paymentStatus ?? '',
        paymentAmount: source?.paymentAmount === null || source?.paymentAmount === undefined ? '' : String(source.paymentAmount),
        paymentCurrency,
        paymentExchangeRate: source?.paymentExchangeRate === null || source?.paymentExchangeRate === undefined
          ? paymentCurrency === 'TWD' ? '' : String(this.exchangeRates.rateFor(paymentCurrency))
          : String(source.paymentExchangeRate),
        note: source?.note ?? '',
        mapsUrl: source?.mapsUrl ?? ''
      });
    }
  }

  get dialogTitle(): string {
    if (this.isTransportDialog) return this.event ? '編輯交通資訊' : '加入交通資訊';
    return this.event ? '編輯行程' : '加入行程';
  }

  get submitLabel(): string {
    if (this.isTransportDialog) return this.event ? '儲存交通資訊' : '加入交通資訊';
    return this.event ? '儲存修改' : '加入行程';
  }

  get isTransportDialog(): boolean {
    return this.transportOnly || this.event?.category === '交通' || this.initialValues?.category === '交通';
  }

  get paymentNeedsRate(): boolean {
    return this.form.controls.paymentStatus.value === 'paid'
      && Number(this.form.controls.paymentAmount.value) > 0
      && this.form.controls.paymentCurrency.value !== 'TWD';
  }

  currencyLabel(currency: string): string {
    return ({ JPY: '日幣', KRW: '韓元', USD: '美金', CNY: '人民幣', TWD: '台幣' } as Record<string, string>)[currency] ?? currency;
  }

  onPaymentCurrencyChange(): void {
    const currency = this.form.controls.paymentCurrency.value as Currency;
    this.form.controls.paymentExchangeRate.setValue(currency === 'TWD' ? '' : String(this.exchangeRates.rateFor(currency)));
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    if (this.isTransportDialog) {
      this.saved.emit({
        time: value.time || '12:00',
        title: value.title.trim(),
        note: '',
        category: '交通',
        priority: 'if-time',
        mapsUrl: '',
        reservationStatus: null,
        paymentStatus: null,
        paymentAmount: null,
        paymentCurrency: null,
        paymentExchangeRate: null,
        paymentAmountTwd: null
      });
      return;
    }
    const paymentAmount = value.paymentAmount === '' ? null : Number(value.paymentAmount);
    const paymentCurrency = paymentAmount === null ? null : value.paymentCurrency as Currency;
    const paymentExchangeRate = Number(value.paymentExchangeRate);
    const paymentRateIncomplete = this.paymentNeedsRate && (!value.paymentExchangeRate || paymentExchangeRate <= 0);
    if ((paymentAmount !== null && paymentAmount <= 0) || paymentRateIncomplete) {
      this.form.markAllAsTouched();
      return;
    }
    this.saved.emit({
      ...value,
      mapsUrl: value.mapsUrl.trim(),
      priority: value.priority as EventPriority,
      reservationStatus: value.reservationStatus ? value.reservationStatus as ReservationStatus : null,
      paymentStatus: value.paymentStatus ? value.paymentStatus as PaymentStatus : null,
      paymentAmount,
      paymentCurrency,
      paymentExchangeRate: paymentCurrency !== 'TWD' && paymentExchangeRate > 0 ? paymentExchangeRate : null,
      paymentAmountTwd: paymentAmount === null
        ? null
          : paymentCurrency === 'TWD'
            ? paymentAmount
            : paymentExchangeRate > 0 ? paymentAmount * paymentExchangeRate : null
    });
  }

  ngOnDestroy(): void {
    this.ratesSubscription.unsubscribe();
  }
}
