import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CreateTripOptionInput, TripOption } from '../../models/trip.model';

@Component({
  selector: 'app-trip-option-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './trip-option-dialog.component.html'
})
export class TripOptionDialogComponent implements OnChanges {
  @Input() open = false;
  @Input() editingOption: TripOption | null = null;
  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly saved = new EventEmitter<CreateTripOptionInput>();
  private readonly formBuilder = inject(FormBuilder);
  readonly form = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(60)]],
    note: ['', Validators.maxLength(160)],
    mapsUrl: ['', Validators.pattern(/^\s*https?:\/\/\S+\s*$/i)]
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true || changes['editingOption']) {
      const option = this.editingOption;
      this.form.reset({ title: option?.title ?? '', note: option?.note ?? '', mapsUrl: option?.mapsUrl ?? '' });
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.saved.emit({ ...value, mapsUrl: value.mapsUrl.trim() });
  }
}
