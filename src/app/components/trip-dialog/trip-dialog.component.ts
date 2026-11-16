import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CreateTripInput, Trip, TripFlight, TripHotel } from '../../models/trip.model';

@Component({
  selector: 'app-trip-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './trip-dialog.component.html'
})
export class TripDialogComponent implements OnChanges {
  @Input() trip: Trip | null = null;
  @Input() open = false;
  @Input() currentUserName = '';
  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly saved = new EventEmitter<CreateTripInput>();
  private readonly formBuilder = inject(FormBuilder);
  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(40)]],
    city: ['', [Validators.required, Validators.maxLength(20)]],
    startDate: ['', Validators.required],
    endDate: ['', Validators.required]
  });
  readonly flightForm = this.formBuilder.nonNullable.group({
    airline: ['', Validators.required],
    flightNumber: ['', Validators.required],
    departure: ['', Validators.required],
    arrival: ['', Validators.required],
    departureAt: ['', Validators.required],
    arrivalAt: ['', Validators.required],
    note: ''
  });
  readonly hotelForm = this.formBuilder.nonNullable.group({
    name: ['', Validators.required],
    address: ['', Validators.required],
    checkIn: ['', Validators.required],
    checkOut: ['', Validators.required],
    mapsUrl: '',
    note: ''
  });
  flights: TripFlight[] = [];
  hotels: TripHotel[] = [];
  dateError = '';
  flightDateError = '';
  hotelDateError = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true || (this.open && changes['trip'])) {
      this.dateError = '';
      this.flightDateError = '';
      this.hotelDateError = '';
      this.form.reset({ name: this.trip?.name ?? '', city: this.trip?.city ?? '', startDate: this.trip?.startDate ?? '', endDate: this.trip?.endDate ?? '' });
      this.flightForm.reset({ airline: '', flightNumber: '', departure: '', arrival: '', departureAt: '', arrivalAt: '', note: '' });
      this.hotelForm.reset({ name: '', address: '', checkIn: '', checkOut: '', mapsUrl: '', note: '' });
      this.flights = [...(this.trip?.flights ?? [])];
      this.hotels = [...(this.trip?.hotels ?? [])];
    }
  }

  addFlight(): void {
    this.flightDateError = '';
    if (this.flightForm.invalid) {
      this.flightForm.markAllAsTouched();
      return;
    }
    const value = this.flightForm.getRawValue();
    if (value.arrivalAt < value.departureAt) {
      this.flightDateError = '抵達時間不能早於出發時間。';
      return;
    }
    this.flights.push({ ...value, id: `flight-${Date.now()}` });
    this.flightForm.reset({ airline: '', flightNumber: '', departure: '', arrival: '', departureAt: '', arrivalAt: '', note: '' });
  }

  removeFlight(flightId: string): void {
    this.flights = this.flights.filter((flight) => flight.id !== flightId);
  }

  addHotel(): void {
    this.hotelDateError = '';
    if (this.hotelForm.invalid) {
      this.hotelForm.markAllAsTouched();
      return;
    }
    const value = this.hotelForm.getRawValue();
    if (value.checkOut < value.checkIn) {
      this.hotelDateError = '退房日期不能早於入住日期。';
      return;
    }
    this.hotels.push({ ...value, id: `hotel-${Date.now()}`, mapsUrl: value.mapsUrl.trim() });
    this.hotelForm.reset({ name: '', address: '', checkIn: '', checkOut: '', mapsUrl: '', note: '' });
  }

  removeHotel(hotelId: string): void {
    this.hotels = this.hotels.filter((hotel) => hotel.id !== hotelId);
  }

  submit(): void {
    this.dateError = '';
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    if (value.endDate < value.startDate) {
      this.dateError = '結束日期不能早於開始日期。';
      return;
    }
    const removedEventDays = this.trip?.days.filter((day) => (day.date < value.startDate || day.date > value.endDate) && day.events.length) ?? [];
    if (removedEventDays.length > 0) {
      this.dateError = '新的日期範圍會移除已有行程，請先刪除或處理那些日期的安排。';
      return;
    }
    this.saved.emit({ ...value, flights: this.flights, hotels: this.hotels });
  }
}
