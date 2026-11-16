import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-empty-trip',
  standalone: true,
  templateUrl: './empty-trip.component.html'
})
export class EmptyTripComponent {
  @Output() readonly createTrip = new EventEmitter<void>();
}
