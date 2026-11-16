import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TripOption } from '../../models/trip.model';

@Component({
  selector: 'app-trip-options',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './trip-options.component.html'
})
export class TripOptionsComponent {
  @Input() options: TripOption[] = [];
  @Output() readonly createOption = new EventEmitter<void>();
  @Output() readonly useOption = new EventEmitter<string>();
  @Output() readonly editOption = new EventEmitter<TripOption>();
  @Output() readonly deleteOption = new EventEmitter<TripOption>();

  onOptionClick(event: MouseEvent, option: TripOption): void {
    const target = event.target;
    if (target instanceof Element && target.closest('a, button')) return;
    this.editOption.emit(option);
  }

  onOptionKeydown(event: KeyboardEvent, option: TripOption): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target;
    if (target instanceof Element && target.closest('a, button')) return;
    event.preventDefault();
    this.editOption.emit(option);
  }

  useOptionClick(event: MouseEvent, optionId: string): void {
    event.stopPropagation();
    this.useOption.emit(optionId);
  }

  deleteOptionClick(event: MouseEvent, option: TripOption): void {
    event.stopPropagation();
    this.deleteOption.emit(option);
  }

  onDragStart(event: DragEvent, option: TripOption): void {
    if (!event.dataTransfer) return;
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.clearData();
    event.dataTransfer.setData('text/x-tabi-option', option.id);
    event.dataTransfer.setData('text/plain', option.id);
  }

  safeUrl(value: string): string {
    try {
      const url = new URL(value || 'https://www.google.com/maps');
      return ['http:', 'https:'].includes(url.protocol) ? url.href : 'https://www.google.com/maps';
    } catch (error) {
      return 'https://www.google.com/maps';
    }
  }
}
