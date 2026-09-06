export interface ApiErrorBody {
  code: string;
  message: string;
  fieldErrors: Record<string, string>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: Record<string, string>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);

    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.fieldErrors = body.fieldErrors;
  }
}

interface CsrfResponse {
  token: string;
  headerName: string;
}

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

function isUnsafeMethod(method: string) {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

function getCookieValue(name: string): string | null {
  const prefix = `${name}=`;

  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith(prefix));

  if (!cookie) {
    return null;
  }

  return decodeURIComponent(
    cookie.slice(prefix.length),
  );
}

async function getCsrf(): Promise<CsrfResponse> {
  const response = await fetch("/api/auth/csrf", {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw await createApiError(response);
  }

  const body =
    (await response.json()) as CsrfResponse;

  const cookieToken =
    getCookieValue("XSRF-TOKEN");

  if (!cookieToken) {
    throw new ApiError(0, {
      code: "CSRF_COOKIE_MISSING",
      message: "CSRF cookie is missing.",
      fieldErrors: {},
    });
  }

  return {
    token: cookieToken,
    headerName: body.headerName,
  };
}

async function createApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as Partial<ApiErrorBody>;

    return new ApiError(response.status, {
      code: body.code ?? "UNKNOWN_ERROR",
      message: body.message ?? "Request failed.",
      fieldErrors: body.fieldErrors ?? {},
    });
  } catch {
    return new ApiError(response.status, {
      code: "UNKNOWN_ERROR",
      message: "Request failed.",
      fieldErrors: {},
    });
  }
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();

  const headers = new Headers(options.headers);

  headers.set("Accept", "application/json");

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (isUnsafeMethod(method)) {
    const csrf = await getCsrf();
    headers.set(csrf.headerName, csrf.token);
  }

  const response = await fetch(path, {
    ...options,
    method,
    headers,
    credentials: "include",
    body:
      options.body === undefined
        ? undefined
        : JSON.stringify(options.body),
  });

  if (!response.ok) {
    throw await createApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function apiGet<T>(path: string) {
  return apiRequest<T>(path);
}

export function apiPost<TResponse, TBody = unknown>(
  path: string,
  body?: TBody,
) {
  return apiRequest<TResponse>(path, {
    method: "POST",
    body,
  });
}

export function apiPatch<TResponse, TBody>(
  path: string,
  body: TBody,
) {
  return apiRequest<TResponse>(path, {
    method: "PATCH",
    body,
  });
}

export function apiPut<
  TResponse = void,
  TBody = undefined,
>(
  path: string,
  body?: TBody,
) {
  return apiRequest<TResponse>(path, {
    method: "PUT",
    body,
  });
}

export function apiDelete(path: string) {
  return apiRequest<void>(path, {
    method: "DELETE",
  });
}