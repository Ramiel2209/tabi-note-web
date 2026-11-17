import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import {
  Trip,
  TripDay,
  TripEvent,
  TripMember,
  TripOption,
} from "../../models/trip.model";
import { TripOptionsComponent } from "../trip-options/trip-options.component";

const categoryIcons: Record<string, string> = {
  景點: "📍",
  餐廳: "🍜",
  交通: "🚆",
  住宿: "🏨",
  其他: "📝",
};
const priorityLabels: Record<string, string> = {
  must: "🌟 超想去",
  "if-time": "🍵 有時間可去",
};

@Component({
  selector: "app-itinerary",
  standalone: true,
  imports: [CommonModule, TripOptionsComponent],
  host: {
    style: "display: block; width: 100%; min-width: 0;",
  },
  templateUrl: "./itinerary.component.html",
})
export class ItineraryComponent {
  @Input({ required: true }) trip!: Trip;
  @Input() activeDayId: string | null = null;
  @Input() canDeleteTrip = true;
  @Output() readonly daySelected = new EventEmitter<string>();
  @Output() readonly addEvent = new EventEmitter<void>();
  @Output() readonly editTrip = new EventEmitter<void>();
  @Output() readonly openLedger = new EventEmitter<void>();
  @Output() readonly deleteEvent = new EventEmitter<string>();
  @Output() readonly editEvent = new EventEmitter<TripEvent>();
  @Output() readonly deleteTrip = new EventEmitter<void>();
  @Output() readonly openInvite = new EventEmitter<void>();
  @Output() readonly createOption = new EventEmitter<void>();
  @Output() readonly optionSelected = new EventEmitter<string>();
  @Output() readonly optionDropped = new EventEmitter<string>();
  @Output() readonly editOption = new EventEmitter<TripOption>();
  @Output() readonly deleteOption = new EventEmitter<TripOption>();
  @Output() readonly editDayNote = new EventEmitter<void>();
  @Output() readonly editSegmentNote = new EventEmitter<TripEvent>();

  get activeDay(): TripDay {
    return (
      this.trip.days.find((day) => day.id === this.activeDayId) ??
      this.trip.days[0]!
    );
  }

  get sortedEvents(): TripEvent[] {
    return [...this.activeDay.events].sort((a, b) =>
      a.time.localeCompare(b.time)
    );
  }

  get collaborators(): TripMember[] {
    if (this.trip.members?.length) return this.trip.members;
    return [
      {
        uid: this.trip.ownerId ?? "owner",
        displayName: this.trip.nickname || "建立者",
        photoURL: null,
      },
    ];
  }

  categoryIcon(category: string): string {
    return categoryIcons[category] ?? "📝";
  }

  priorityLabel(priority: string): string {
    return priorityLabels[priority] ?? "未分類";
  }

  reservationLabel(status: string): string {
    return status === "booked" ? "已訂位" : "待訂位";
  }

  paymentLabel(status: string): string {
    return status === "paid" ? "已付款" : "待付款";
  }

  formatPaymentAmount(event: TripEvent): string {
    const amountTwd =
      event.paymentAmountTwd ??
      (event.paymentCurrency &&
      event.paymentCurrency !== "TWD" &&
      typeof event.paymentExchangeRate === "number"
        ? (event.paymentAmount ?? 0) * event.paymentExchangeRate
        : event.paymentAmount ?? 0);
    return this.formatTwd(amountTwd);
  }

  formatOriginalPaymentAmount(event: TripEvent): string {
    const symbols: Record<string, string> = {
      JPY: "¥",
      KRW: "₩",
      USD: "$",
      CNY: "¥",
      TWD: "NT$",
    };
    const symbol = symbols[event.paymentCurrency ?? "JPY"] ?? "¥";
    return `${symbol}${
      event.paymentAmount?.toLocaleString("zh-TW", {
        maximumFractionDigits: 0,
      }) ?? ""
    }`;
  }

  formatTwd(amount: number): string {
    return `NT$${amount.toLocaleString("zh-TW", { maximumFractionDigits: 0 })}`;
  }

  safeUrl(value: string): string {
    try {
      const url = new URL(value || "https://www.google.com/maps");
      return ["http:", "https:"].includes(url.protocol)
        ? url.href
        : "https://www.google.com/maps";
    } catch (error) {
      return "https://www.google.com/maps";
    }
  }

  allowOptionDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  }

  dropOption(event: DragEvent): void {
    event.preventDefault();
    const optionId =
      event.dataTransfer?.getData("text/x-tabi-option") ||
      event.dataTransfer?.getData("text/plain");
    if (optionId) this.optionDropped.emit(optionId);
  }
}
