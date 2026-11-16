import { CommonModule } from "@angular/common";
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import {
  CreateTripOptionInput,
  OPTION_KINDS,
  OPTION_KIND_ICONS,
  OptionKind,
  TripOption,
} from "../../models/trip.model";

@Component({
  selector: "app-trip-option-dialog",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: "./trip-option-dialog.component.html",
})
export class TripOptionDialogComponent implements OnChanges {
  @Input() open = false;
  @Input() editingOption: TripOption | null = null;
  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly saved = new EventEmitter<CreateTripOptionInput>();
  private readonly formBuilder = inject(FormBuilder);
  readonly kinds = OPTION_KINDS;
  readonly form = this.formBuilder.nonNullable.group({
    title: ["", [Validators.required, Validators.maxLength(60)]],
    kind: ["" as OptionKind | "", Validators.required],
    note: ["", Validators.maxLength(160)],
    mapsUrl: ["", Validators.pattern(/^\s*https?:\/\/\S+\s*$/i)],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["open"]?.currentValue === true || changes["editingOption"]) {
      const option = this.editingOption;
      this.form.reset({
        title: option?.title ?? "",
        kind: option?.kind ?? "",
        note: option?.note ?? "",
        mapsUrl: option?.mapsUrl ?? "",
      });
    }
  }

  kindIcon(kind: OptionKind): string {
    return OPTION_KIND_ICONS[kind];
  }

  submit(): void {
    const value = this.form.getRawValue();
    if (this.form.invalid || !value.kind) {
      this.form.markAllAsTouched();
      return;
    }
    this.saved.emit({
      title: value.title,
      note: value.note,
      mapsUrl: value.mapsUrl.trim(),
      kind: value.kind,
    });
  }
}
