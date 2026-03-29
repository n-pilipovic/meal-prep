import { Injectable, signal, computed } from '@angular/core';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  type User,
  type Auth,
} from 'firebase/auth';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth: Auth;
  private readonly firebaseUser = signal<User | null>(null);
  private readonly initialized = signal(false);

  readonly isLoggedIn = computed(() => this.firebaseUser() !== null);
  readonly user = this.firebaseUser.asReadonly();
  readonly displayName = computed(() => this.firebaseUser()?.displayName ?? null);
  readonly photoURL = computed(() => this.firebaseUser()?.photoURL ?? null);
  readonly email = computed(() => this.firebaseUser()?.email ?? null);
  readonly uid = computed(() => this.firebaseUser()?.uid ?? null);
  readonly isReady = this.initialized.asReadonly();

  constructor() {
    const app = initializeApp(environment.firebase);
    this.auth = getAuth(app);

    onAuthStateChanged(this.auth, (user) => {
      this.firebaseUser.set(user);
      this.initialized.set(true);
    });
  }

  async signInWithGoogle(): Promise<User> {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(this.auth, provider);
    return result.user;
  }

  async registerWithEmail(email: string, password: string, name: string): Promise<User> {
    const result = await createUserWithEmailAndPassword(this.auth, email, password);
    await updateProfile(result.user, { displayName: name });
    this.firebaseUser.set(result.user);
    return result.user;
  }

  async signInWithEmail(email: string, password: string): Promise<User> {
    const result = await signInWithEmailAndPassword(this.auth, email, password);
    return result.user;
  }

  async signOutUser(): Promise<void> {
    await signOut(this.auth);
  }

  async getIdToken(): Promise<string | null> {
    const user = this.firebaseUser();
    if (!user) return null;
    return user.getIdToken();
  }
}
