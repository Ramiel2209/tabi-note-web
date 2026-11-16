import { NgIf } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-floating-actions',
  standalone: true,
  imports: [NgIf],
  templateUrl: './floating-actions.component.html'
})
export class FloatingActionsComponent {
  @Input() disabled = false;
  @Output() readonly addEvent = new EventEmitter<void>();
  @Output() readonly openLedger = new EventEmitter<void>();
  menuOpen = false;

  toggleMenu(): void {
    if (!this.disabled) this.menuOpen = !this.menuOpen;
  }

  choose(action: 'event' | 'expense'): void {
    this.menuOpen = false;
    if (action === 'event') this.addEvent.emit();
    if (action === 'expense') this.openLedger.emit();
  }
}
