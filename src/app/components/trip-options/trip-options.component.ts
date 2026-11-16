import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import {
  OPTION_KINDS,
  OPTION_KIND_ICONS,
  OptionKind,
  TripOption,
} from "../../models/trip.model";

@Component({
  selector: "app-trip-options",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./trip-options.component.html",
})
export class TripOptionsComponent {
  @Input() options: TripOption[] = [];
  @Output() readonly createOption = new EventEmitter<void>();
  @Output() readonly useOption = new EventEmitter<string>();
  @Output() readonly editOption = new EventEmitter<TripOption>();
  @Output() readonly deleteOption = new EventEmitter<TripOption>();

  readonly kinds = OPTION_KINDS;
  filterKind: OptionKind | null = null;
  filterCreator: string | null = null;

  get creators(): string[] {
    return [
      ...new Set(
        this.options
          .map((option) => option.createdBy)
          .filter((name): name is string => !!name)
      ),
    ];
  }

  get activeCreator(): string | null {
    return this.filterCreator !== null &&
      this.creators.includes(this.filterCreator)
      ? this.filterCreator
      : null;
  }

  get filteredOptions(): TripOption[] {
    const creator = this.activeCreator;
    return this.options.filter(
      (option) =>
        (this.filterKind === null || option.kind === this.filterKind) &&
        (creator === null || option.createdBy === creator)
    );
  }

  kindIcon(kind: OptionKind): string {
    return OPTION_KIND_ICONS[kind];
  }

  onOptionClick(event: MouseEvent, option: TripOption): void {
    const target = event.target;
    if (target instanceof Element && target.closest("a, button")) return;
    this.editOption.emit(option);
  }

  onOptionKeydown(event: KeyboardEvent, option: TripOption): void {
    if (event.key !== "Enter" && event.key !== " ") return;
    const target = event.target;
    if (target instanceof Element && target.closest("a, button")) return;
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
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.clearData();
    event.dataTransfer.setData("text/x-tabi-option", option.id);
    event.dataTransfer.setData("text/plain", option.id);
  }

  safeUrl(value: string): string {
    try {
      const url = new URL(value || "https://www.google.com/maps");
      return ["http:", "https:"].includes(url.protocol)
        ? url.href
        : "https://www.google.com/maps";
    } catch (error) {
      return "https://www.google.com/maps";
    }
  }
}
