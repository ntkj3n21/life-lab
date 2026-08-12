import { create } from "zustand";

import { ApiError } from "../lib/api";
import {
  getCurrentAccount,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  type Account,
  type LoginInput,
  type RegisterInput,
} from "../modules/auth/services/authApi";

import {
  prepareForAccountLogout,
  resetAccountScopedState,
} from "./accountSession";

interface AuthStore {
  account: Account | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  error: ApiError | null;

  initialize: () => Promise<void>;
  register: (input: RegisterInput) => Promise<Account>;
  login: (input: LoginInput) => Promise<Account>;
  logout: () => Promise<void>;
  clearError: () => void;
}

function toApiError(error: unknown) {
  if (error instanceof ApiError) {
    return error;
  }

  return new ApiError(0, {
    code: "UNKNOWN_ERROR",
    message: "Something went wrong.",
    fieldErrors: {},
  });
}

export const useAuthStore = create<AuthStore>((set) => ({
  account: null,
  isAuthenticated: false,
  isInitializing: true,
  error: null,

  initialize: async () => {
    set({
      isInitializing: true,
      error: null,
    });

    try {
      const account = await getCurrentAccount();

      set({
        account,
        isAuthenticated: true,
      });
    } catch (error) {
      const apiError = toApiError(error);

      if (
        apiError.status === 401 ||
        apiError.code === "UNAUTHENTICATED"
      ) {
        set({
          account: null,
          isAuthenticated: false,
        });
      } else {
        set({
          account: null,
          isAuthenticated: false,
          error: apiError,
        });
      }
    } finally {
      set({
        isInitializing: false,
      });
    }
  },

  register: async (input) => {
    set({
      error: null,
    });

    try {
      return await registerRequest(input);
    } catch (error) {
      const apiError = toApiError(error);

      set({
        error: apiError,
      });

      throw apiError;
    }
  },

  login: async (input) => {
    set({
      error: null,
    });

    try {
      const account = await loginRequest(input);

      set({
        account,
        isAuthenticated: true,
      });

      return account;
    } catch (error) {
      const apiError = toApiError(error);

      set({
        account: null,
        isAuthenticated: false,
        error: apiError,
      });

      throw apiError;
    }
  },

  logout: async () => {
    set({
      error: null,
    });

    try {
      await prepareForAccountLogout();

      await logoutRequest();

      resetAccountScopedState();

      set({
        account: null,
        isAuthenticated: false,
      });
    } catch (error) {
      const apiError =
        toApiError(error);

      set({
        error: apiError,
      });

      throw apiError;
    }
  },

  clearError: () => {
    set({
      error: null,
    });
  },
}));