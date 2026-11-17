import { Injectable, NgZone, OnDestroy } from "@angular/core";
import { BehaviorSubject, Subscription } from "rxjs";
import { User } from "firebase/auth";
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  DocumentData,
  getDoc,
  onSnapshot,
  QuerySnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { firebaseDb } from "../firebase.client";
import {
  CreateEventInput,
  CreateExpenseInput,
  CreateTripInput,
  CreateTripOptionInput,
  Expense,
  Trip,
  TripDay,
  TripEvent,
  TripFlight,
  TripHotel,
  TripMember,
  TripOption,
  TripState,
} from "../models/trip.model";
import { AuthService } from "./auth.service";

const STORAGE_KEY = "tabi-note-local-v2";
const LEGACY_MIGRATION_KEY = "tabi-note-local-migrated-v1";
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const EMPTY_STATE: TripState = {
  activeTripId: null,
  activeDayId: null,
  trips: [],
};

@Injectable({ providedIn: "root" })
export class TripStoreService implements OnDestroy {
  private stateStorageKey = STORAGE_KEY;
  private readonly stateSubject = new BehaviorSubject<TripState>(
    this.loadState()
  );
  private readonly authSubscription: Subscription;
  private remoteUnsubscribe: (() => void) | null = null;
  private remoteReady = false;
  private remoteFirstSnapshot = true;
  private pendingActiveTripId: string | null = null;
  readonly state$ = this.stateSubject.asObservable();

  constructor(
    private readonly zone: NgZone,
    private readonly auth: AuthService
  ) {
    this.authSubscription = this.auth.user$.subscribe((user) =>
      this.handleAuthChange(user)
    );
  }

  get snapshot(): TripState {
    return this.stateSubject.value;
  }

  setActiveTrip(tripId: string): void {
    const trip = this.snapshot.trips.find(
      (candidate) => candidate.id === tripId
    );
    if (!trip) return;
    this.commit({
      ...this.snapshot,
      activeTripId: trip.id,
      activeDayId: trip.days[0]?.id ?? null,
    });
  }

  setActiveDay(dayId: string): void {
    this.commit({ ...this.snapshot, activeDayId: dayId });
  }

  addTrip(input: CreateTripInput): Trip {
    const id = `trip-${Date.now()}`;
    const creator = this.currentMember();
    const trip: Trip = {
      id,
      icon: "🎒",
      nickname: creator.displayName,
      ownerId: creator.uid,
      memberIds: [creator.uid],
      members: [creator],
      inviteCode: this.generateInviteCode(),
      name: input.name,
      city: input.city,
      startDate: input.startDate,
      endDate: input.endDate,
      flights: this.normalizeFlights(input.flights),
      hotels: this.normalizeHotels(input.hotels),
      days: this.createDays(input.startDate, input.endDate, id),
      expenses: [],
      options: [],
    };
    this.commit(
      {
        ...this.snapshot,
        activeTripId: id,
        activeDayId: trip.days[0]?.id ?? null,
        trips: [...this.snapshot.trips, trip],
      },
      trip
    );
    return trip;
  }

  updateTrip(input: CreateTripInput): void {
    const trip = this.activeTrip;
    if (!trip) return;
    const days = this.createDays(input.startDate, input.endDate, trip.id).map(
      (day) => {
        const existingDay = trip.days.find(
          (candidate) => candidate.date === day.date
        );
        return existingDay
          ? {
              ...day,
              id: existingDay.id,
              title: existingDay.title,
              events: existingDay.events,
              note: existingDay.note ?? "",
            }
          : day;
      }
    );
    const updatedTrip: Trip = {
      ...trip,
      name: input.name,
      city: input.city,
      startDate: input.startDate,
      endDate: input.endDate,
      flights: this.normalizeFlights(input.flights),
      hotels: this.normalizeHotels(input.hotels),
      days,
    };
    const activeDayId = days.some((day) => day.id === this.snapshot.activeDayId)
      ? this.snapshot.activeDayId
      : days[0]?.id ?? null;
    this.commit(
      {
        ...this.snapshot,
        activeDayId,
        trips: this.snapshot.trips.map((candidate) =>
          candidate.id === trip.id ? updatedTrip : candidate
        ),
      },
      updatedTrip
    );
  }

  addEvent(
    eventInput: CreateEventInput,
    sourceOptionId: string | null = null
  ): void {
    const trip = this.activeTrip;
    const day = this.activeDay;
    if (!trip || !day) return;
    const event: TripEvent = {
      ...eventInput,
      mapsUrl:
        eventInput.mapsUrl ||
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          eventInput.title
        )}`,
      reservationStatus: eventInput.reservationStatus ?? null,
      paymentStatus: eventInput.paymentStatus ?? null,
      paymentAmount: eventInput.paymentAmount ?? null,
      paymentCurrency: eventInput.paymentCurrency ?? null,
      paymentExchangeRate: eventInput.paymentExchangeRate ?? null,
      paymentAmountTwd:
        eventInput.paymentAmountTwd ??
        (eventInput.paymentCurrency === "TWD"
          ? eventInput.paymentAmount ?? null
          : null),
      createdBy: this.auth.displayName || trip.nickname || "Google 使用者",
      id: `event-${Date.now()}`,
    };
    const options = sourceOptionId
      ? (trip.options ?? []).filter((option) => option.id !== sourceOptionId)
      : trip.options;
    const updatedTrip = {
      ...trip,
      days: trip.days.map((candidate) =>
        candidate.id === day.id
          ? { ...candidate, events: [...candidate.events, event] }
          : candidate
      ),
      options,
    };
    this.replaceTrip(updatedTrip);
  }

  deleteEvent(eventId: string): void {
    const trip = this.activeTrip;
    if (!trip) return;
    const updatedTrip = {
      ...trip,
      days: trip.days.map((day) => ({
        ...day,
        events: day.events.filter((event) => event.id !== eventId),
      })),
    };
    this.replaceTrip(updatedTrip);
  }

  updateSegmentNote(eventId: string, note: string): void {
    const trip = this.activeTrip;
    if (!trip) return;
    const updatedTrip = {
      ...trip,
      days: trip.days.map((day) => ({
        ...day,
        events: day.events.map((event) =>
          event.id === eventId ? { ...event, segmentNote: note.trim() } : event
        ),
      })),
    };
    this.replaceTrip(updatedTrip);
  }

  updateEvent(eventId: string, eventInput: CreateEventInput): void {
    const trip = this.activeTrip;
    if (!trip) return;
    const updatedTrip = {
      ...trip,
      days: trip.days.map((day) => ({
        ...day,
        events: day.events.map((event) =>
          event.id === eventId
            ? {
                ...event,
                ...eventInput,
                mapsUrl:
                  eventInput.mapsUrl ||
                  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    eventInput.title
                  )}`,
                reservationStatus: eventInput.reservationStatus ?? null,
                paymentStatus: eventInput.paymentStatus ?? null,
                paymentAmount: eventInput.paymentAmount ?? null,
                paymentCurrency: eventInput.paymentCurrency ?? null,
                paymentExchangeRate: eventInput.paymentExchangeRate ?? null,
                paymentAmountTwd:
                  eventInput.paymentAmountTwd ??
                  (eventInput.paymentCurrency === "TWD"
                    ? eventInput.paymentAmount ?? null
                    : null),
              }
            : event
        ),
      })),
    };
    this.replaceTrip(updatedTrip);
  }

  addExpense(expenseInput: CreateExpenseInput): void {
    const trip = this.activeTrip;
    if (!trip) return;
    const linkedEventId = expenseInput.linkedEventId ?? null;
    const expense: Expense = {
      ...expenseInput,
      id: `expense-${Date.now()}`,
      date: expenseInput.date || this.todayDate(),
      currency: expenseInput.currency,
      exchangeRate: expenseInput.exchangeRate ?? null,
      amountTwd: expenseInput.amountTwd,
      payerId: expenseInput.payerId ?? null,
      participantIds: expenseInput.participantIds ?? [],
      linkedEventId,
    };
    const days = this.updateLinkedEventPayment(trip.days, null, expense);
    this.replaceTrip({ ...trip, days, expenses: [...trip.expenses, expense] });
  }

  updateExpense(expenseId: string, expenseInput: CreateExpenseInput): void {
    const trip = this.activeTrip;
    const existing = trip?.expenses.find((expense) => expense.id === expenseId);
    if (!trip || !existing) return;
    const expense: Expense = {
      ...existing,
      ...expenseInput,
      id: existing.id,
      date: expenseInput.date || this.todayDate(),
      currency: expenseInput.currency,
      exchangeRate: expenseInput.exchangeRate ?? null,
      amountTwd: expenseInput.amountTwd,
      payerId: expenseInput.payerId ?? null,
      participantIds: expenseInput.participantIds ?? [],
      linkedEventId: expenseInput.linkedEventId ?? null,
    };
    const days = this.updateLinkedEventPayment(
      trip.days,
      existing.linkedEventId ?? null,
      expense
    );
    const expenses = trip.expenses.map((candidate) =>
      candidate.id === expenseId ? expense : candidate
    );
    this.replaceTrip({ ...trip, days, expenses });
  }

  addOption(input: CreateTripOptionInput): void {
    const trip = this.activeTrip;
    if (!trip) return;
    const option: TripOption = {
      ...input,
      mapsUrl:
        input.mapsUrl ||
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          input.title
        )}`,
      createdBy: this.auth.displayName || trip.nickname || "Google 使用者",
      id: `option-${Date.now()}`,
    };
    this.replaceTrip({ ...trip, options: [...(trip.options ?? []), option] });
  }

  updateOption(optionId: string, input: CreateTripOptionInput): void {
    const trip = this.activeTrip;
    if (!trip) return;
    const options = (trip.options ?? []).map((option) =>
      option.id === optionId
        ? {
            ...option,
            ...input,
            mapsUrl:
              input.mapsUrl ||
              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                input.title
              )}`,
          }
        : option
    );
    this.replaceTrip({ ...trip, options });
  }

  deleteOption(optionId: string): void {
    const trip = this.activeTrip;
    if (!trip) return;
    this.replaceTrip({
      ...trip,
      options: (trip.options ?? []).filter((option) => option.id !== optionId),
    });
  }

  updateDayNote(note: string): void {
    const trip = this.activeTrip;
    const day = this.activeDay;
    if (!trip || !day) return;
    const updatedTrip = {
      ...trip,
      days: trip.days.map((candidate) =>
        candidate.id === day.id
          ? { ...candidate, note: note.trim() }
          : candidate
      ),
    };
    this.replaceTrip(updatedTrip);
  }

  async joinTripByCode(inviteCode: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error("請先使用 Google 登入。");
    const normalizedCode = inviteCode.trim().toUpperCase().replace(/\s/g, "");
    if (!/^[A-HJ-NP-Z2-9]{8}$/.test(normalizedCode))
      throw new Error("邀請碼格式不正確，請輸入 8 碼邀請碼。");

    const inviteSnapshot = await getDoc(
      doc(firebaseDb, "inviteCodes", normalizedCode)
    );
    if (!inviteSnapshot.exists())
      throw new Error("找不到這組邀請碼，請確認是否輸入正確。");
    const inviteData = inviteSnapshot.data();
    const tripId =
      typeof inviteData["tripId"] === "string" ? inviteData["tripId"] : "";
    if (!tripId) throw new Error("這組邀請碼目前無法使用。");

    this.pendingActiveTripId = tripId;
    try {
      await updateDoc(doc(firebaseDb, "trips", tripId), {
        memberIds: arrayUnion(user.uid),
        members: arrayUnion(this.currentMember()),
      });
    } catch (error) {
      console.warn("加入旅程失敗。", error);
      throw new Error("加入旅程失敗，請確認邀請碼仍有效。");
    }
  }

  ensureCollaboration(tripId: string): Trip | null {
    const trip = this.snapshot.trips.find(
      (candidate) => candidate.id === tripId
    );
    if (!trip || !this.auth.currentUser) return trip ?? null;
    const preparedTrip = this.prepareRemoteTrip(trip);
    const hasMetadata = Boolean(
      trip.inviteCode &&
        trip.ownerId &&
        trip.memberIds?.length &&
        trip.members?.length
    );
    if (!hasMetadata)
      this.commit(
        {
          ...this.snapshot,
          trips: this.snapshot.trips.map((candidate) =>
            candidate.id === trip.id ? preparedTrip : candidate
          ),
        },
        preparedTrip
      );
    return preparedTrip;
  }

  deleteTrip(tripId: string): void {
    const deletedTrip = this.snapshot.trips.find((trip) => trip.id === tripId);
    const trips = this.snapshot.trips.filter((trip) => trip.id !== tripId);
    const wasActive = this.snapshot.activeTripId === tripId;
    const nextTrip = wasActive ? trips[0] ?? null : this.activeTrip;
    this.commit(
      {
        ...this.snapshot,
        trips,
        activeTripId: wasActive
          ? nextTrip?.id ?? null
          : this.snapshot.activeTripId,
        activeDayId: wasActive
          ? nextTrip?.days[0]?.id ?? null
          : this.snapshot.activeDayId,
      },
      undefined,
      deletedTrip
    );
  }

  get activeTrip(): Trip | null {
    return (
      this.snapshot.trips.find(
        (trip) => trip.id === this.snapshot.activeTripId
      ) ?? null
    );
  }

  get activeDay(): TripDay | null {
    return (
      this.activeTrip?.days.find(
        (day) => day.id === this.snapshot.activeDayId
      ) ??
      this.activeTrip?.days[0] ??
      null
    );
  }

  ngOnDestroy(): void {
    this.authSubscription.unsubscribe();
    this.remoteUnsubscribe?.();
  }

  private replaceTrip(updatedTrip: Trip): void {
    this.commit(
      {
        ...this.snapshot,
        trips: this.snapshot.trips.map((trip) =>
          trip.id === updatedTrip.id ? updatedTrip : trip
        ),
      },
      updatedTrip
    );
  }

  private handleAuthChange(user: User | null): void {
    this.remoteUnsubscribe?.();
    this.remoteUnsubscribe = null;
    this.remoteReady = false;
    this.remoteFirstSnapshot = true;
    this.pendingActiveTripId = null;
    if (!user) {
      this.stateStorageKey = STORAGE_KEY;
      this.stateSubject.next(this.cloneEmptyState());
      return;
    }

    const userState = this.loadStateForUser(user.uid);
    this.persistLocal(userState);
    this.stateSubject.next(userState);

    const tripsQuery = query(
      collection(firebaseDb, "trips"),
      where("memberIds", "array-contains", user.uid)
    );
    this.remoteUnsubscribe = onSnapshot(
      tripsQuery,
      (snapshot) => this.zone.run(() => this.applyRemoteSnapshot(snapshot)),
      (error) =>
        console.warn("Firestore 旅程同步失敗，暫時使用本機資料。", error)
    );
  }

  private applyRemoteSnapshot(snapshot: QuerySnapshot<DocumentData>): void {
    const remoteTrips = snapshot.docs.map((documentSnapshot) =>
      this.normalizeTrip(documentSnapshot.data(), documentSnapshot.id)
    );
    let mergedTrips = remoteTrips;

    if (this.remoteFirstSnapshot) {
      const remoteIds = new Set(remoteTrips.map((trip) => trip.id));
      const localOnlyTrips = this.snapshot.trips
        .filter((trip) => !remoteIds.has(trip.id))
        .map((trip) => this.prepareRemoteTrip(trip));
      mergedTrips = [...remoteTrips, ...localOnlyTrips];
      this.remoteFirstSnapshot = false;
      this.remoteReady = true;
      for (const trip of localOnlyTrips) void this.saveRemoteTrip(trip);
    }

    const preferredTripId =
      this.pendingActiveTripId ?? this.snapshot.activeTripId;
    const activeTripId = mergedTrips.some((trip) => trip.id === preferredTripId)
      ? preferredTripId
      : mergedTrips[0]?.id ?? null;
    if (this.pendingActiveTripId && activeTripId === this.pendingActiveTripId)
      this.pendingActiveTripId = null;
    const activeTrip = mergedTrips.find((trip) => trip.id === activeTripId);
    const activeDayId = activeTrip?.days.some(
      (day) => day.id === this.snapshot.activeDayId
    )
      ? this.snapshot.activeDayId
      : activeTrip?.days[0]?.id ?? null;
    const nextState = {
      ...this.snapshot,
      trips: mergedTrips,
      activeTripId,
      activeDayId,
    };
    this.persistLocal(nextState);
    this.stateSubject.next(nextState);
  }

  private commit(
    nextState: TripState,
    changedTrip?: Trip,
    deletedTrip?: Trip
  ): void {
    this.persistLocal(nextState);
    this.stateSubject.next(nextState);
    if (!this.remoteReady || !this.auth.currentUser) return;
    if (changedTrip) void this.saveRemoteTrip(changedTrip);
    if (deletedTrip) void this.deleteRemoteTrip(deletedTrip);
  }

  private async saveRemoteTrip(trip: Trip): Promise<void> {
    const remoteTrip = this.prepareRemoteTrip(trip);
    if (!remoteTrip.inviteCode) return;
    try {
      await Promise.all([
        setDoc(doc(firebaseDb, "trips", remoteTrip.id), remoteTrip),
        ...(remoteTrip.ownerId === this.auth.currentUser?.uid
          ? [
              setDoc(doc(firebaseDb, "inviteCodes", remoteTrip.inviteCode), {
                tripId: remoteTrip.id,
                ownerId: remoteTrip.ownerId,
                tripName: remoteTrip.name,
                updatedAt: Date.now(),
              }),
            ]
          : []),
      ]);
    } catch (error) {
      console.warn("旅程寫入 Firestore 失敗，本機資料仍已保存。", error);
    }
  }

  private async deleteRemoteTrip(trip: Trip): Promise<void> {
    try {
      const deletes = [deleteDoc(doc(firebaseDb, "trips", trip.id))];
      if (trip.inviteCode)
        deletes.push(
          deleteDoc(doc(firebaseDb, "inviteCodes", trip.inviteCode))
        );
      await Promise.all(deletes);
    } catch (error) {
      console.warn("旅程從 Firestore 刪除失敗。", error);
    }
  }

  private prepareRemoteTrip(trip: Trip): Trip {
    const user = this.auth.currentUser;
    if (!user) return trip;
    const currentMember = this.currentMember();
    const members = trip.members?.length
      ? trip.members
      : [
          {
            uid: trip.ownerId || user.uid,
            displayName: trip.nickname || currentMember.displayName,
            photoURL: null,
          },
        ];
    const memberIds = trip.memberIds?.length
      ? trip.memberIds
      : members.map((member) => member.uid).filter(Boolean);
    return {
      ...trip,
      ownerId: trip.ownerId || user.uid,
      memberIds: memberIds.length ? memberIds : [user.uid],
      members: members.length ? members : [currentMember],
      inviteCode: trip.inviteCode || this.generateInviteCode(),
    };
  }

  private currentMember(): TripMember {
    const user = this.auth.currentUser;
    return {
      uid: user?.uid ?? "",
      displayName: this.auth.displayName || "Google 使用者",
      photoURL: user?.photoURL ?? null,
    };
  }

  private updateLinkedEventPayment(
    days: TripDay[],
    previousLinkedEventId: string | null,
    expense: Expense | null
  ): TripDay[] {
    const linkedEventId = expense?.linkedEventId ?? null;
    return days.map((day) => ({
      ...day,
      events: day.events.map((event) => {
        if (
          previousLinkedEventId &&
          event.id === previousLinkedEventId &&
          event.id !== linkedEventId
        ) {
          return {
            ...event,
            paymentStatus: null,
            paymentAmount: null,
            paymentCurrency: null,
            paymentExchangeRate: null,
            paymentAmountTwd: null,
          };
        }
        if (linkedEventId && event.id === linkedEventId && expense) {
          return {
            ...event,
            paymentStatus: "paid" as const,
            paymentAmount: expense.amount,
            paymentCurrency: expense.currency,
            paymentExchangeRate: expense.exchangeRate,
            paymentAmountTwd: expense.amountTwd,
          };
        }
        return event;
      }),
    }));
  }

  private generateInviteCode(): string {
    const values = new Uint32Array(8);
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.getRandomValues === "function"
    ) {
      crypto.getRandomValues(values);
    } else {
      for (let index = 0; index < values.length; index += 1)
        values[index] = Math.floor(Math.random() * 0x100000000);
    }
    return Array.from(
      values,
      (value) => INVITE_CODE_ALPHABET[value % INVITE_CODE_ALPHABET.length]
    ).join("");
  }

  private persistLocal(state: TripState): void {
    try {
      localStorage.setItem(this.stateStorageKey, JSON.stringify(state));
    } catch (error) {
      console.warn("目前瀏覽器無法保存本機資料。", error);
    }
  }

  private todayDate(): string {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(today.getDate()).padStart(2, "0")}`;
  }

  private loadState(): TripState {
    return this.readStoredState(STORAGE_KEY) ?? this.cloneEmptyState();
  }

  private loadStateForUser(userId: string): TripState {
    const userStorageKey = `${STORAGE_KEY}-${userId}`;
    const userState = this.readStoredState(userStorageKey, false);
    this.stateStorageKey = userStorageKey;
    if (userState) return userState;

    const legacyState = this.readStoredState(STORAGE_KEY, false);
    if (!this.hasLegacyMigrationMarker() && legacyState) {
      try {
        localStorage.setItem(LEGACY_MIGRATION_KEY, userId);
      } catch (error) {
        console.warn("目前瀏覽器無法保存本機資料歸屬。", error);
      }
      return legacyState;
    }
    return this.cloneEmptyState();
  }

  private readStoredState(
    storageKey: string,
    allowEmptyFallback = true
  ): TripState | null {
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return allowEmptyFallback ? this.cloneEmptyState() : null;
      const state = JSON.parse(stored) as TripState;
      return {
        ...state,
        trips: state.trips.map((trip) => ({
          ...trip,
          days: trip.days.map((day) => ({
            ...day,
            title: this.cleanDayTitle(day.title),
            note: day.note ?? "",
          })),
          options: trip.options ?? [],
          flights: this.normalizeFlights(trip.flights),
          hotels: this.normalizeHotels(trip.hotels),
          memberIds: trip.memberIds ?? [],
          members: trip.members ?? [],
          inviteCode: trip.inviteCode ?? "",
        })),
      };
    } catch (error) {
      return allowEmptyFallback ? this.cloneEmptyState() : null;
    }
  }

  private hasLegacyMigrationMarker(): boolean {
    try {
      return Boolean(localStorage.getItem(LEGACY_MIGRATION_KEY));
    } catch (error) {
      return true;
    }
  }

  private normalizeTrip(data: DocumentData, id: string): Trip {
    const source = data as Partial<Trip>;
    const members =
      source.members ??
      (source.nickname
        ? [
            {
              uid: source.ownerId ?? "",
              displayName: source.nickname,
              photoURL: null,
            },
          ]
        : []);
    const memberIds = source.memberIds?.length
      ? source.memberIds
      : members.map((member) => member.uid).filter(Boolean);
    return {
      id,
      icon: source.icon || "🎒",
      nickname: source.nickname || "Google 使用者",
      ownerId: source.ownerId ?? null,
      memberIds,
      members,
      inviteCode: source.inviteCode ?? "",
      name: source.name || "未命名旅程",
      city: source.city || "",
      startDate: source.startDate || "",
      endDate: source.endDate || "",
      days: (source.days ?? []).map((day) => ({
        ...day,
        title: this.cleanDayTitle(day.title),
        note: day.note ?? "",
      })),
      flights: this.normalizeFlights(source.flights),
      hotels: this.normalizeHotels(source.hotels),
      expenses: source.expenses ?? [],
      options: source.options ?? [],
    };
  }

  private cloneEmptyState(): TripState {
    return JSON.parse(JSON.stringify(EMPTY_STATE)) as TripState;
  }

  private createDays(
    startDate: string,
    endDate: string,
    tripId: string
  ): TripDay[] {
    const days: TripDay[] = [];
    const cursor = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    while (cursor <= end) {
      const date = `${cursor.getFullYear()}-${String(
        cursor.getMonth() + 1
      ).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      const number = days.length + 1;
      days.push({
        id: `${tripId}-day-${number}`,
        date,
        label: `${date.slice(5).replace("-", "/")} · ${
          WEEKDAYS[cursor.getDay()]
        }`,
        title: `Day ${number}`,
        events: [],
        note: "",
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }

  private normalizeFlights(flights: TripFlight[] | undefined): TripFlight[] {
    return (flights ?? []).map((flight, index) => ({
      ...flight,
      id: flight.id || `flight-${Date.now()}-${index}`,
      note: flight.note ?? "",
    }));
  }

  private normalizeHotels(hotels: TripHotel[] | undefined): TripHotel[] {
    return (hotels ?? []).map((hotel, index) => ({
      ...hotel,
      id: hotel.id || `hotel-${Date.now()}-${index}`,
      address: hotel.address ?? "",
      note: hotel.note ?? "",
      mapsUrl:
        hotel.mapsUrl ||
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${hotel.name} ${hotel.address}`
        )}`,
    }));
  }

  private cleanDayTitle(title: string): string {
    return title.replace(/\s*·\s*待規劃$/, "");
  }
}
