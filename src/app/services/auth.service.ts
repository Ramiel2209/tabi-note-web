import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { GoogleAuthProvider, User, onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { firebaseAuth } from '../firebase.client';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly userSubject = new BehaviorSubject<User | null>(null);
  readonly user$ = this.userSubject.asObservable();

  constructor(private readonly zone: NgZone) {
    onAuthStateChanged(
      firebaseAuth,
      (user) => this.zone.run(() => this.userSubject.next(user)),
      (error) => {
        console.warn('Firebase 登入狀態讀取失敗。', error);
        this.zone.run(() => this.userSubject.next(null));
      }
    );
  }

  get currentUser(): User | null {
    return this.userSubject.value;
  }

  get displayName(): string {
    const user = this.currentUser;
    return user?.displayName?.trim() || user?.email?.split('@')[0] || '';
  }

  async signInWithGoogle(): Promise<void> {
    await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
  }

  async signOut(): Promise<void> {
    await firebaseSignOut(firebaseAuth);
  }
}
