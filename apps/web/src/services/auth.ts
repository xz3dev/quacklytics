import { create } from "@/lib/store";
import { request } from "@/lib/fetch";
import { user as userSchema } from "@quacklytics/contracts";
import type { User } from "@/model/user";
interface AuthState {
  loading: boolean;
  user: User | null;
  login: (email: string, password: string) => Promise<string>;
  register: (email: string, password: string) => Promise<string>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<User | null>;
  setUser: (user: User | null) => void;
}
export const useAuthStore = create<AuthState>((set, get) => ({
  loading: true,
  user: null,
  setUser: (user) => set({ user }),
  checkAuth: async () => {
    try {
      const user = userSchema.parse(await request("GET", "me"));
      set({ user, loading: false });
      return user;
    } catch {
      set({ user: null, loading: false });
      return null;
    }
  },
  login: async (email, password) => {
    await request("POST", "auth/sign-in/email", { email, password });
    await get().checkAuth();
    return "/projects";
  },
  register: async (email, password) => {
    await request("POST", "auth/sign-up/email", {
      email,
      password,
      name: email,
    });
    await get().checkAuth();
    return "/projects";
  },
  logout: async () => {
    await request("POST", "auth/sign-out", {});
    window.location.replace("/login");
  },
}));
