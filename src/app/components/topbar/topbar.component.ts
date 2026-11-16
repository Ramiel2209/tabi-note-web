import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnDestroy, Output, inject } from '@angular/core';
import { User } from 'firebase/auth';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './topbar.component.html'
})
export class TopbarComponent implements OnDestroy {
  @Output() readonly menuToggle = new EventEmitter<void>();
  @Output() readonly authError = new EventEmitter<string>();
  user: User | null = null;
  authBusy = false;
  private readonly auth = inject(AuthService);
  private readonly userSubscription: Subscription;

  constructor() {
    this.userSubscription = this.auth.user$.subscribe((user) => this.user = user);
  }

  async signIn(): Promise<void> {
    this.authBusy = true;
    try {
      await this.auth.signInWithGoogle();
    } catch (error) {
      console.error('Google 登入失敗。', error);
      this.authError.emit('Google 登入沒有完成，請確認 Firebase 已開啟 Google 登入。');
    } finally {
      this.authBusy = false;
    }
  }

  async signOut(): Promise<void> {
    try {
      await this.auth.signOut();
    } catch (error) {
      console.error('登出失敗。', error);
      this.authError.emit('登出失敗，請稍後再試。');
    }
  }

  ngOnDestroy(): void {
    this.userSubscription.unsubscribe();
  }
}
