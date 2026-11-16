import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { Trip, TripMember } from '../../models/trip.model';

@Component({
  selector: 'app-trip-invite-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './trip-invite-dialog.component.html'
})
export class TripInviteDialogComponent implements OnChanges {
  @Input() open = false;
  @Input() trip: Trip | null = null;
  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly copied = new EventEmitter<string>();
  copyFeedback = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true) this.copyFeedback = '';
  }

  get members(): TripMember[] {
    if (this.trip?.members?.length) return this.trip.members;
    if (!this.trip) return [];
    return [{ uid: this.trip.ownerId ?? 'owner', displayName: this.trip.nickname || '建立者', photoURL: null }];
  }

  isOwner(member: TripMember): boolean {
    return member.uid === this.trip?.ownerId;
  }

  async copyCode(): Promise<void> {
    const code = this.trip?.inviteCode;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      this.copyFeedback = '已複製';
      this.copied.emit('邀請碼已複製，可以貼給旅伴了！');
    } catch (error) {
      this.copyFeedback = '請手動複製';
      this.copied.emit('瀏覽器不允許自動複製，請長按或選取邀請碼。');
    }
  }
}
