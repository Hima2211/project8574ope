import { QueryClient } from "@tanstack/react-query";

function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    throw new Error(`${res.status}: ${res.statusText}`);
  }
}

// Store token from Privy authentication (set by the useAuth hook)
let cachedAuthToken: string | null = null;

const TOKEN_STORAGE_KEY = 'supabaseAuthToken';

/**
 * Initialize auth token from localStorage on app startup
 * This ensures token persists across page refreshes
 */
export function initializeAuthToken() {
  try {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) {
      cachedAuthToken = stored;
      console.log('✅ Auth token restored from localStorage');
      return stored;
    }
  } catch (err) {
    console.warn('Failed to restore auth token from localStorage:', err);
  }
  return null;
}

export function setAuthToken(token: string | null) {
  // Trim tokens to avoid accidental whitespace/newlines causing invalid signature errors
  const cleaned = token ? token.trim() : null;
  cachedAuthToken = cleaned;
  try {
    if (cleaned) {
      localStorage.setItem(TOKEN_STORAGE_KEY, cleaned);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch (err) {
    // ignore localStorage failures in SSR or restricted environments
  }
}

function getAuthToken(): string | null {
  if (cachedAuthToken) return cachedAuthToken;
  try {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) {
      cachedAuthToken = stored;
      return stored;
    }
  } catch (err) {
    // ignore
  }
  return null;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<any> {
  const authToken = getAuthToken();
  
  // Debug logging
  if (!authToken) {
    console.error('❌ No auth token found for request to:', url);
    console.warn('   This will likely result in 401 Unauthorized');
  } else {
    console.debug(`✅ Auth token found (${authToken.length} chars) for:`, url.split('/').pop());
  }

  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {}),
    },
    credentials: "include",
  };

  if (data !== undefined) {
    options.body = JSON.stringify(data);
  }

  const res = await fetch(url, options);

  try {
    throwIfResNotOk(res);
  } catch (error) {
    let errorMessage = `Error: ${res.status}`;
    try {
      const errorData = await res.json();
      errorMessage += `: ${JSON.stringify(errorData)}`;
    } catch {
      errorMessage += `: ${res.statusText}`;
    }
    console.error("API Request Error:", errorMessage);
    throw new Error(errorMessage);
  }

  // Check if response has content
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return res.json();
  }

  // If no JSON content, return empty object
  return {};
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const url = queryKey[0] as string;
        const params = queryKey[1] as Record<string, string> | undefined;

        let fullUrl = url;
        if (params) {
          const searchParams = new URLSearchParams(params);
          fullUrl += `?${searchParams.toString()}`;
        }

        const authToken = getAuthToken();
          // Debug logging for queries
          if (!authToken) {
            console.warn('No auth token found for query to:', fullUrl);
          } else {
            try {
              console.debug('Using auth token for query to', fullUrl.split('/').pop(), 'tokenPrefix=', authToken.substring(0,8));
            } catch {}
          }

        const res = await fetch(fullUrl, {
          credentials: "include",
          headers: {
            ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {}),
          },
        });

        try {
          throwIfResNotOk(res);
        } catch (error) {
          let errorMessage = `Error: ${res.status}`;
          try {
            const errorData = await res.json();
            errorMessage += `: ${JSON.stringify(errorData)}`;
          } catch {
            errorMessage += `: ${res.statusText}`;
          }
          console.error("Query Function Error:", errorMessage);
          throw new Error(errorMessage);
        }

        // Check if response has content
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          return res.json();
        }
        return null;
      },
    },
  },
});

// Admin token management
let cachedAdminToken: string | null = null;

const ADMIN_TOKEN_STORAGE_KEY = 'adminToken';

export function setAdminToken(token: string | null) {
  cachedAdminToken = token;
  try {
    if (token) {
      localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    }
  } catch (err) {
    // ignore localStorage failures
  }
}

function getAdminToken(): string | null {
  if (cachedAdminToken) return cachedAdminToken;
  try {
    const stored = localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
    if (stored) {
      cachedAdminToken = stored;
      return stored;
    }
  } catch (err) {
    // ignore
  }
  return null;
}

// Admin API request (for use in admin pages)
export async function adminApiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<any> {
  const adminToken = getAdminToken();
  
  if (!adminToken) {
    console.error('❌ No admin token found for request to:', url);
    throw new Error('Admin not authenticated');
  }

  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${adminToken}`,
    },
    credentials: "include",
  };

  if (data !== undefined) {
    options.body = JSON.stringify(data);
  }

  const res = await fetch(url, options);

  try {
    throwIfResNotOk(res);
  } catch (error) {
    let errorMessage = `Error: ${res.status}`;
    try {
      const errorData = await res.json();
      errorMessage += `: ${JSON.stringify(errorData)}`;
    } catch {
      errorMessage += `: ${res.statusText}`;
    }
    console.error("Admin API Request Error:", errorMessage);
    throw new Error(errorMessage);
  }

  // Check if response has content
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return res.json();
  }

  return {};
}

export default queryClient;