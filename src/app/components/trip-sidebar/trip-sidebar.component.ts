import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Trip } from '../../models/trip.model';

@Component({
  selector: 'app-trip-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './trip-sidebar.component.html'
})
export class TripSidebarComponent {
  @Input() trips: Trip[] = [];
  @Input() activeTripId: string | null = null;
  @Input() open = false;
  @Output() readonly selectTrip = new EventEmitter<string>();
  @Output() readonly createTrip = new EventEmitter<void>();
  @Output() readonly joinTrip = new EventEmitter<void>();
  @Output() readonly close = new EventEmitter<void>();

  formatDateRange(start: string, end: string): string {
    if (!start && !end) return '尚未決定日期';
    const format = (value: string) => value ? value.slice(5).replace('-', '/') : '未定';
    return `${format(start)} — ${format(end)}`;
  }
}
