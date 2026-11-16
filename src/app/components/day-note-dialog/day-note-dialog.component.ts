import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-day-note-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './day-note-dialog.component.html'
})
export class DayNoteDialogComponent implements OnChanges {
  @Input() open = false;
  @Input() note = '';
  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly saved = new EventEmitter<string>();
  private readonly formBuilder = inject(FormBuilder);
  readonly form = this.formBuilder.nonNullable.group({
    note: ['', Validators.maxLength(500)]
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true || changes['note']) {
      this.form.reset({ note: this.note ?? '' });
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saved.emit(this.form.controls.note.value.trim());
  }
}
