import { CommonModule } from "@angular/common";
import { Component, HostListener, OnDestroy } from "@angular/core";
import { Subscription } from "rxjs";
import {
  CreateEventInput,
  CreateExpenseInput,
  CreateTripInput,
  CreateTripOptionInput,
  Expense,
  OptionKind,
  Trip,
  TripEvent,
  TripOption,
  TripState,
} from "./models/trip.model";
import { AuthService } from "./services/auth.service";
import { TripStoreService } from "./services/trip-store.service";
import { EmptyTripComponent } from "./components/empty-trip/empty-trip.component";
import { ConfirmDialogComponent } from "./components/confirm-dialog/confirm-dialog.component";
import { DayNoteDialogComponent } from "./components/day-note-dialog/day-note-dialog.component";
import { EventDialogComponent } from "./components/event-dialog/event-dialog.component";
import { ExpenseDialogComponent } from "./components/expense-dialog/expense-dialog.component";
import { ExpenseDrawerComponent } from "./components/expense-drawer/expense-drawer.component";
import { FloatingActionsComponent } from "./components/floating-actions/floating-actions.component";
import { ItineraryComponent } from "./components/itinerary/itinerary.component";
import { JoinTripDialogComponent } from "./components/join-trip-dialog/join-trip-dialog.component";
import { TopbarComponent } from "./components/topbar/topbar.component";
import { TripDialogComponent } from "./components/trip-dialog/trip-dialog.component";
import { TripInviteDialogComponent } from "./components/trip-invite-dialog/trip-invite-dialog.component";
import { TripOptionDialogComponent } from "./components/trip-option-dialog/trip-option-dialog.component";
import { TripSidebarComponent } from "./components/trip-sidebar/trip-sidebar.component";
import { findDuplicateOption } from "./utils/place-matcher";

const OPTION_KIND_TO_CATEGORY: Record<OptionKind, string> = {
  正餐: "餐廳",
  甜點: "餐廳",
  逛街: "其他",
  景點: "景點",
};

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    CommonModule,
    ConfirmDialogComponent,
    DayNoteDialogComponent,
    EmptyTripComponent,
    EventDialogComponent,
    ExpenseDialogComponent,
    ExpenseDrawerComponent,
    FloatingActionsComponent,
    ItineraryComponent,
    JoinTripDialogComponent,
    TopbarComponent,
    TripDialogComponent,
    TripInviteDialogComponent,
    TripOptionDialogComponent,
    TripSidebarComponent,
  ],
  templateUrl: "./app.component.html",
})
export class AppComponent implements OnDestroy {
  state: TripState;
  menuOpen = false;
  ledgerOpen = false;
  tripDialogOpen = false;
  eventDialogOpen = false;
  dayNoteDialogOpen = false;
  transportDialogOnly = false;
  expenseDialogOpen = false;
  optionDialogOpen = false;
  inviteDialogOpen = false;
  joinTripDialogOpen = false;
  joinTripBusy = false;
  confirmDialogOpen = false;
  confirmTitle = "";
  confirmMessage = "";
  duplicateDialogOpen = false;
  duplicateMessage = "";
  private pendingOptionInput: CreateTripOptionInput | null = null;
  editingTrip: Trip | null = null;
  editingEvent: TripEvent | null = null;
  editingExpense: Expense | null = null;
  eventInitialValues: Partial<CreateEventInput> | null = null;
  private pendingDelete: {
    type: "trip" | "event" | "option";
    id: string;
  } | null = null;
  private pendingOptionId: string | null = null;
  editingOption: TripOption | null = null;
  toastMessage = "";
  private readonly stateSubscription: Subscription;
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly store: TripStoreService,
    private readonly auth: AuthService
  ) {
    this.state = this.store.snapshot;
    this.stateSubscription = this.store.state$.subscribe(
      (nextState) => (this.state = nextState)
    );
  }

  get activeTrip(): Trip | null {
    return this.store.activeTrip;
  }

  get activeDayId(): string | null {
    return this.state.activeDayId;
  }

  get canDeleteActiveTrip(): boolean {
    const trip = this.activeTrip;
    const userId = this.auth.currentUser?.uid;
    return !trip?.ownerId || !userId || trip.ownerId === userId;
  }

  get currentUserName(): string {
    return this.auth.displayName;
  }

  get currentUserId(): string | null {
    return this.auth.currentUser?.uid ?? null;
  }

  get activeDayNote(): string {
    return (
      this.activeTrip?.days.find((day) => day.id === this.activeDayId)?.note ??
      ""
    );
  }

  selectTrip(tripId: string): void {
    this.store.setActiveTrip(tripId);
    this.menuOpen = false;
  }

  selectDay(dayId: string): void {
    this.store.setActiveDay(dayId);
  }

  openTripDialog(): void {
    if (!this.auth.currentUser) {
      this.showToast("請先使用 Google 登入，再建立旅程。");
      return;
    }
    this.menuOpen = false;
    this.editingTrip = null;
    this.tripDialogOpen = true;
  }

  saveTrip(input: CreateTripInput): void {
    if (!this.auth.currentUser) {
      this.showToast("請先使用 Google 登入，再建立旅程。");
      return;
    }
    if (this.editingTrip) {
      this.store.updateTrip(input);
      this.showToast("旅程已更新！");
    } else {
      this.store.addTrip(input);
      this.showToast("新的旅程建立好了！");
    }
    this.closeTripDialog();
    this.menuOpen = false;
  }

  openEditTrip(): void {
    if (!this.activeTrip) return;
    this.editingTrip = this.activeTrip;
    this.tripDialogOpen = true;
  }

  closeTripDialog(): void {
    this.tripDialogOpen = false;
    this.editingTrip = null;
  }

  addEvent(input: CreateEventInput): void {
    const optionId = this.pendingOptionId;
    if (this.editingEvent) {
      this.store.updateEvent(this.editingEvent.id, input);
      this.showToast(
        this.transportDialogOnly ? "交通資訊已更新！" : "行程已更新！"
      );
    } else {
      this.store.addEvent(input, optionId);
      if (optionId) {
        this.showToast("行程已加入，備選已自動移除！");
      } else {
        this.showToast(
          this.transportDialogOnly ? "交通資訊已加入！" : "行程已加入！"
        );
      }
    }
    this.closeEventDialog();
  }

  requestDeleteEvent(eventId: string): void {
    const event = this.activeTrip?.days
      .flatMap((day) => day.events)
      .find((candidate) => candidate.id === eventId);
    if (!event) return;
    this.pendingDelete = { type: "event", id: eventId };
    const isTransport = event.category === "交通";
    this.confirmTitle = isTransport ? "刪除這段交通資訊？" : "刪除這個行程？";
    this.confirmMessage = isTransport
      ? `「${event.title}」會從兩個行程之間移除。`
      : `「${event.title}」會從這趟旅程移除，已連動的帳本紀錄不會被刪除。`;
    this.confirmDialogOpen = true;
  }

  addExpense(input: CreateExpenseInput): void {
    if (this.editingExpense) {
      this.store.updateExpense(this.editingExpense.id, input);
      this.showToast("支出已更新！");
    } else {
      this.store.addExpense(input);
      this.showToast("這筆支出記下來了！");
    }
    this.closeExpenseDialog();
    this.ledgerOpen = true;
  }

  openEventDialog(): void {
    if (!this.activeTrip) {
      this.showToast("請先建立一趟旅程");
      return;
    }
    this.editingEvent = null;
    this.pendingOptionId = null;
    this.eventInitialValues = null;
    this.transportDialogOnly = false;
    this.eventDialogOpen = true;
  }

  openTransportDialog(initialValues: Partial<CreateEventInput>): void {
    if (!this.activeTrip) {
      this.showToast("請先建立一趟旅程");
      return;
    }
    this.editingEvent = null;
    this.pendingOptionId = null;
    this.eventInitialValues = initialValues;
    this.transportDialogOnly = true;
    this.eventDialogOpen = true;
  }

  openEditEvent(event: TripEvent): void {
    this.editingEvent = event;
    this.pendingOptionId = null;
    this.eventInitialValues = null;
    this.transportDialogOnly = false;
    this.eventDialogOpen = true;
  }

  openEditTransport(event: TripEvent): void {
    this.editingEvent = event;
    this.pendingOptionId = null;
    this.eventInitialValues = null;
    this.transportDialogOnly = true;
    this.eventDialogOpen = true;
  }

  openOptionInEventDialog(optionId: string): void {
    const option = this.activeTrip?.options?.find(
      (candidate) => candidate.id === optionId
    );
    if (!option) return;
    this.editingEvent = null;
    this.pendingOptionId = optionId;
    this.eventInitialValues = {
      title: option.title,
      note: option.note,
      mapsUrl: option.mapsUrl,
      ...(option.kind
        ? { category: OPTION_KIND_TO_CATEGORY[option.kind] }
        : {}),
    };
    this.transportDialogOnly = false;
    this.eventDialogOpen = true;
  }

  closeEventDialog(): void {
    this.eventDialogOpen = false;
    this.editingEvent = null;
    this.eventInitialValues = null;
    this.transportDialogOnly = false;
    this.pendingOptionId = null;
  }

  openOptionDialog(): void {
    if (!this.activeTrip) {
      this.showToast("請先建立一趟旅程");
      return;
    }
    this.editingOption = null;
    this.optionDialogOpen = true;
  }

  openEditOption(option: TripOption): void {
    this.editingOption = option;
    this.optionDialogOpen = true;
  }

  closeOptionDialog(): void {
    this.optionDialogOpen = false;
    this.editingOption = null;
  }

  openDayNoteDialog(): void {
    if (!this.activeTrip) {
      this.showToast("請先建立一趟旅程");
      return;
    }
    this.dayNoteDialogOpen = true;
  }

  saveDayNote(note: string): void {
    this.store.updateDayNote(note);
    this.dayNoteDialogOpen = false;
    this.showToast("每日 Note 已儲存");
  }

  closeDayNoteDialog(): void {
    this.dayNoteDialogOpen = false;
  }

  openInviteDialog(): void {
    if (!this.auth.currentUser || !this.activeTrip) {
      this.showToast(
        this.auth.currentUser ? "請先建立一趟旅程。" : "請先使用 Google 登入。"
      );
      return;
    }
    this.store.ensureCollaboration(this.activeTrip.id);
    this.inviteDialogOpen = true;
  }

  openJoinTripDialog(): void {
    if (!this.auth.currentUser) {
      this.showToast("請先使用 Google 登入，再加入旅程。");
      return;
    }
    this.menuOpen = false;
    this.joinTripDialogOpen = true;
  }

  async joinTrip(inviteCode: string): Promise<void> {
    this.joinTripBusy = true;
    try {
      await this.store.joinTripByCode(inviteCode);
      this.joinTripDialogOpen = false;
      this.showToast("已加入旅程，正在同步內容！");
    } catch (error) {
      this.showToast(
        error instanceof Error ? error.message : "加入旅程失敗，請稍後再試。"
      );
    } finally {
      this.joinTripBusy = false;
    }
  }

  saveOption(input: CreateTripOptionInput): void {
    const duplicate = findDuplicateOption(
      input,
      this.activeTrip?.options ?? [],
      this.editingOption?.id
    );
    if (duplicate) {
      this.pendingOptionInput = input;
      this.duplicateMessage = `「${
        duplicate.title
      }」已經在行程備選裡了，看起來是同一個地點。確定還要${
        this.editingOption ? "儲存" : "新增"
      }嗎？`;
      this.duplicateDialogOpen = true;
      return;
    }
    this.commitOption(input);
  }

  confirmDuplicateOption(): void {
    const input = this.pendingOptionInput;
    this.closeDuplicateDialog();
    if (input) this.commitOption(input);
  }

  closeDuplicateDialog(): void {
    this.duplicateDialogOpen = false;
    this.pendingOptionInput = null;
  }

  private commitOption(input: CreateTripOptionInput): void {
    if (this.editingOption) {
      this.store.updateOption(this.editingOption.id, input);
      this.showToast("備選已更新");
    } else {
      this.store.addOption(input);
      this.showToast("已放進行程備選");
    }
    this.closeOptionDialog();
  }

  requestDeleteOption(option: TripOption): void {
    this.pendingDelete = { type: "option", id: option.id };
    this.confirmTitle = "刪除這個備選？";
    this.confirmMessage = `「${option.title}」會從行程備選移除，這個動作無法復原。`;
    this.confirmDialogOpen = true;
  }

  requestDeleteTrip(): void {
    const trip = this.activeTrip;
    if (!trip) return;
    this.pendingDelete = { type: "trip", id: trip.id };
    this.confirmTitle = "刪除這趟旅程？";
    this.confirmMessage = `「${trip.name}」的行程、帳本與備選都會移除，這個動作無法復原。`;
    this.confirmDialogOpen = true;
  }

  confirmDelete(): void {
    if (!this.pendingDelete) return;
    if (this.pendingDelete.type === "trip") {
      this.store.deleteTrip(this.pendingDelete.id);
      this.ledgerOpen = false;
      this.showToast("旅程已刪除");
    } else if (this.pendingDelete.type === "event") {
      this.store.deleteEvent(this.pendingDelete.id);
      this.showToast("已刪除這個安排");
    } else {
      this.store.deleteOption(this.pendingDelete.id);
      this.showToast("已刪除這個備選");
    }
    this.closeConfirmDialog();
  }

  closeConfirmDialog(): void {
    this.confirmDialogOpen = false;
    this.pendingDelete = null;
  }

  showInviteCopied(message: string): void {
    this.showToast(message);
  }

  @HostListener("document:keydown.escape")
  closeTopLayer(): void {
    if (this.duplicateDialogOpen) return this.closeDuplicateDialog();
    if (this.confirmDialogOpen) return this.closeConfirmDialog();
    if (this.joinTripDialogOpen) return void (this.joinTripDialogOpen = false);
    if (this.inviteDialogOpen) return void (this.inviteDialogOpen = false);
    if (this.eventDialogOpen) return this.closeEventDialog();
    if (this.expenseDialogOpen) return this.closeExpenseDialog();
    if (this.optionDialogOpen) return this.closeOptionDialog();
    if (this.dayNoteDialogOpen) return this.closeDayNoteDialog();
    if (this.tripDialogOpen) return this.closeTripDialog();
    if (this.ledgerOpen) return void (this.ledgerOpen = false);
    if (this.menuOpen) this.menuOpen = false;
  }

  openExpenseDrawer(): void {
    if (!this.activeTrip) {
      this.showToast("請先建立一趟旅程");
      return;
    }
    this.ledgerOpen = true;
  }

  openExpenseDialog(): void {
    if (!this.activeTrip) {
      this.showToast("請先建立一趟旅程");
      return;
    }
    this.editingExpense = null;
    this.expenseDialogOpen = true;
  }

  openEditExpense(expense: Expense): void {
    this.editingExpense = expense;
    this.expenseDialogOpen = true;
  }

  closeExpenseDialog(): void {
    this.expenseDialogOpen = false;
    this.editingExpense = null;
  }

  showToast(message: string): void {
    this.toastMessage = message;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toastMessage = ""), 2200);
  }

  ngOnDestroy(): void {
    this.stateSubscription.unsubscribe();
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }
}
