import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-join-trip-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './join-trip-dialog.component.html'
})
export class JoinTripDialogComponent implements OnChanges {
  @Input() open = false;
  @Input() submitting = false;
  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly saved = new EventEmitter<string>();
  private readonly formBuilder = inject(FormBuilder);
  readonly form = this.formBuilder.nonNullable.group({
    inviteCode: ['', [Validators.required, Validators.pattern(/^[A-HJ-NP-Z2-9]{8}$/i)]]
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true) this.form.reset({ inviteCode: '' });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saved.emit(this.form.controls.inviteCode.value.trim().toUpperCase());
  }
}
