import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";

@Component({
  selector: "app-confirm-dialog",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./confirm-dialog.component.html",
})
export class ConfirmDialogComponent {
  @Input() open = false;
  @Input() title = "確定要刪除嗎？";
  @Input() message = "";
  @Input() confirmLabel = "刪除";
  @Input() confirmClass = "danger-solid-button";
  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly confirmed = new EventEmitter<void>();
}
