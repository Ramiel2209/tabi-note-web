import { CommonModule } from "@angular/common";
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject,
} from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import {
  CreateExpenseInput,
  Currency,
  Expense,
  ExpensePayer,
  ExpenseSplit,
  Trip,
  TripEvent,
  TripMember,
} from "../../models/trip.model";
import { ExchangeRateService } from "../../services/exchange-rate.service";

@Component({
  selector: "app-expense-dialog",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: "./expense-dialog.component.html",
})
export class ExpenseDialogComponent implements OnChanges, OnDestroy {
  @Input() trip: Trip | null = null;
  @Input() expense: Expense | null = null;
  @Input() currentUserId: string | null = null;
  @Input() currentUserName = "我";
  @Input() open = false;
  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly saved = new EventEmitter<CreateExpenseInput>();
  private readonly formBuilder = inject(FormBuilder);
  private readonly exchangeRates = inject(ExchangeRateService);
  readonly form = this.formBuilder.nonNullable.group({
    title: ["", [Validators.required, Validators.maxLength(50)]],
    amount: ["", Validators.required],
    currency: ["JPY"],
    exchangeRate: [""],
    category: ["", Validators.required],
    payer: ["", Validators.required],
    split: ["", Validators.required],
    participantIds: this.formBuilder.nonNullable.control<string[]>([]),
    participantAmounts: this.formBuilder.nonNullable.control<
      Record<string, number>
    >({}),
    linkToItinerary: false,
    date: "",
    linkedEventId: "",
    settled: false,
  });
  formSubmitted = false;
  private readonly ratesSubscription = this.exchangeRates.rates$.subscribe(
    () => {
      if (
        !this.open ||
        this.expense ||
        this.form.controls.currency.value === "TWD" ||
        this.form.controls.exchangeRate.dirty
      )
        return;
      this.form.controls.exchangeRate.setValue(
        String(
          this.exchangeRates.rateFor(
            this.form.controls.currency.value as Currency
          )
        ),
        { emitEvent: false }
      );
    }
  );

  get linkingItinerary(): boolean {
    return this.form.controls.linkToItinerary.value;
  }

  get members(): TripMember[] {
    if (!this.trip) return [];
    const members = this.trip.members?.length
      ? [...this.trip.members]
      : [
          {
            uid: this.trip.ownerId ?? this.currentUserId ?? "owner",
            displayName: this.trip.nickname || this.currentUserName,
            photoURL: null,
          },
        ];
    if (
      this.currentUserId &&
      !members.some((member) => member.uid === this.currentUserId)
    ) {
      return [
        {
          uid: this.currentUserId,
          displayName: this.currentUserName,
          photoURL: null,
        },
        ...members,
      ];
    }
    return members;
  }

  get selectedParticipantIds(): string[] {
    return this.form.controls.participantIds.value;
  }

  get customAssignedAmount(): number {
    return Object.values(this.form.controls.participantAmounts.value).reduce(
      (sum, amount) => sum + amount,
      0
    );
  }

  get customAmountDifference(): number {
    return Number(this.form.controls.amount.value) - this.customAssignedAmount;
  }

  get customAmountsMismatch(): boolean {
    return Math.abs(this.customAmountDifference) > 0.01;
  }

  get customAmountSummary(): string {
    return `已分配 ${this.customAssignedAmount.toLocaleString(
      "zh-TW"
    )}／總金額 ${(Number(this.form.controls.amount.value) || 0).toLocaleString(
      "zh-TW"
    )}`;
  }

  get isForeignCurrency(): boolean {
    return this.form.controls.currency.value !== "TWD";
  }

  currencyLabel(currency: string): string {
    return (
      (
        {
          JPY: "日幣",
          KRW: "韓元",
          USD: "美金",
          CNY: "人民幣",
          TWD: "台幣",
        } as Record<string, string>
      )[currency] ?? currency
    );
  }

  get previewAmountTwd(): number | null {
    const amount = Number(this.form.controls.amount.value);
    if (!amount || amount <= 0) return null;
    if (!this.isForeignCurrency) return amount;
    const rate = Number(this.form.controls.exchangeRate.value);
    return rate > 0 ? amount * rate : null;
  }

  get amountIsInvalid(): boolean {
    return (
      this.form.controls.amount.invalid ||
      Number(this.form.controls.amount.value) <= 0
    );
  }

  isParticipantSelected(memberId: string): boolean {
    return this.selectedParticipantIds.includes(memberId);
  }

  get selectedDateEvents(): TripEvent[] {
    const date = this.form.controls.date.value;
    return this.trip?.days.find((day) => day.date === date)?.events ?? [];
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes["open"]?.currentValue === true ||
      (this.open && changes["expense"])
    ) {
      this.formSubmitted = false;
      this.resetForm();
    }
  }

  private resetForm(): void {
    const expense = this.expense;
    if (!expense) {
      this.form.reset({
        title: "",
        amount: "",
        currency: "JPY",
        exchangeRate: String(this.exchangeRates.rateFor("JPY")),
        category: "",
        payer: "",
        split: "",
        participantIds: [],
        participantAmounts: {},
        linkToItinerary: false,
        date: "",
        linkedEventId: "",
        settled: false,
      });
      return;
    }
    const payerId = this.resolvePayerId(expense);
    this.form.reset({
      title: expense.title,
      amount: String(expense.amount),
      currency: expense.currency ?? "TWD",
      exchangeRate: expense.exchangeRate
        ? String(expense.exchangeRate)
        : expense.currency && expense.currency !== "TWD"
        ? String(this.exchangeRates.rateFor(expense.currency))
        : "",
      category: expense.category,
      payer: payerId,
      split: expense.split,
      participantIds: this.resolveParticipantIds(expense),
      participantAmounts: expense.participantAmounts ?? {},
      linkToItinerary: Boolean(expense.linkedEventId),
      date: expense.linkedEventId ? expense.date : "",
      linkedEventId: expense.linkedEventId ?? "",
      settled: Boolean(expense.settled),
    });
  }

  private resolvePayerId(expense: Expense): string {
    const memberIds = this.members.map((member) => member.uid);
    if (expense.payerId && memberIds.includes(expense.payerId))
      return expense.payerId;
    if (
      expense.payer === "我" &&
      this.currentUserId &&
      memberIds.includes(this.currentUserId)
    )
      return this.currentUserId;
    if (expense.payer === "旅伴")
      return (
        memberIds.find((id) => id !== this.currentUserId) ?? memberIds[0] ?? ""
      );
    return memberIds[0] ?? "";
  }

  private resolveParticipantIds(expense: Expense): string[] {
    const memberIds = this.members.map((member) => member.uid);
    const savedIds =
      expense.participantIds?.filter((id) => memberIds.includes(id)) ?? [];
    if (savedIds.length) return savedIds;
    if (expense.split === "payer") return [this.resolvePayerId(expense)];
    return memberIds;
  }

  onLinkToggle(): void {
    if (!this.linkingItinerary)
      this.form.patchValue({ date: "", linkedEventId: "" });
  }

  onDateChange(): void {
    this.form.controls.linkedEventId.setValue("");
  }

  onCurrencyChange(): void {
    const currency = this.form.controls.currency.value as Currency;
    this.form.controls.exchangeRate.setValue(
      currency === "TWD" ? "" : String(this.exchangeRates.rateFor(currency))
    );
  }

  onPayerChange(): void {
    if (this.form.controls.split.value === "payer") {
      this.form.controls.participantIds.setValue(
        this.form.controls.payer.value ? [this.form.controls.payer.value] : []
      );
    }
  }

  onSplitChange(): void {
    if (this.form.controls.split.value === "payer") {
      this.form.controls.participantIds.setValue(
        this.form.controls.payer.value ? [this.form.controls.payer.value] : []
      );
    } else if (this.selectedParticipantIds.length === 0) {
      this.form.controls.participantIds.setValue(
        this.members.map((member) => member.uid)
      );
    }
    if (this.form.controls.split.value === "custom") {
      const current = this.form.controls.participantAmounts.value;
      this.form.controls.participantAmounts.setValue(
        Object.fromEntries(
          this.members.map((member) => [member.uid, current[member.uid] ?? 0])
        )
      );
    }
  }

  customAmountFor(memberId: string): number {
    return this.form.controls.participantAmounts.value[memberId] ?? 0;
  }

  updateCustomAmount(memberId: string, value: string): void {
    const amount = Number(value);
    this.form.controls.participantAmounts.setValue({
      ...this.form.controls.participantAmounts.value,
      [memberId]: Number.isFinite(amount) && amount > 0 ? amount : 0,
    });
  }

  toggleParticipant(memberId: string): void {
    const selected = new Set(this.selectedParticipantIds);
    if (selected.has(memberId)) selected.delete(memberId);
    else selected.add(memberId);
    this.form.controls.participantIds.setValue([...selected]);
  }

  formatTwd(amount: number): string {
    return `NT$${amount.toLocaleString("zh-TW", { maximumFractionDigits: 0 })}`;
  }

  submit(): void {
    this.formSubmitted = true;
    const value = this.form.getRawValue();
    const linkIsIncomplete =
      value.linkToItinerary && (!value.date || !value.linkedEventId);
    const exchangeRate = Number(value.exchangeRate);
    const rateIsIncomplete =
      value.currency !== "TWD" && (!value.exchangeRate || exchangeRate <= 0);
    const participantsIncomplete =
      value.split === "half" && value.participantIds.length === 0;
    const customAmountsIncomplete =
      value.split === "custom" &&
      (Object.values(value.participantAmounts).some((amount) => amount < 0) ||
        this.customAmountsMismatch);
    if (
      this.form.invalid ||
      Number(value.amount) <= 0 ||
      linkIsIncomplete ||
      rateIsIncomplete ||
      participantsIncomplete ||
      customAmountsIncomplete
    ) {
      this.form.markAllAsTouched();
      return;
    }
    const amount = Number(value.amount);
    const payerId = value.payer;
    this.saved.emit({
      title: value.title,
      amount,
      category: value.category,
      payer: (payerId === this.currentUserId ? "我" : "旅伴") as ExpensePayer,
      split: value.split as ExpenseSplit,
      payerId: payerId || null,
      participantIds:
        value.split === "half"
          ? value.participantIds
          : value.split === "custom"
          ? Object.entries(value.participantAmounts)
              .filter(([, amount]) => amount > 0)
              .map(([memberId]) => memberId)
          : [payerId],
      participantAmounts:
        value.split === "custom"
          ? Object.fromEntries(
              Object.entries(value.participantAmounts).filter(
                ([, amount]) => amount > 0
              )
            )
          : undefined,
      currency: value.currency as Currency,
      exchangeRate: value.currency !== "TWD" ? exchangeRate : null,
      amountTwd: value.currency !== "TWD" ? amount * exchangeRate : amount,
      date: value.linkToItinerary ? value.date : undefined,
      linkedEventId: value.linkToItinerary ? value.linkedEventId : null,
      settled: value.settled,
    });
  }

  ngOnDestroy(): void {
    this.ratesSubscription.unsubscribe();
  }
}
