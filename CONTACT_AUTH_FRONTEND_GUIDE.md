# Contact Auth Frontend Guide

This guide describes how the frontend should implement contact login against the current backend contract.

## 1. Use Cookie-Backed Auth by Default

- Send requests with credentials enabled.
- Do not store the contact token in local storage when the browser can rely on the `pf_contact_token` cookie.
- Keep bearer token fallback only for non-browser clients or embedded flows that cannot use cookies.

Example axios client setup:

```ts
const client = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});
```

## 2. Resolve Tenant Context Correctly

The backend accepts these optional fields on `POST /contact-auth/login`:

- `organization_id`
- `organization_subdomain`
- `organization_domain`

Frontend rules:

1. On an organization subdomain or custom domain, do not override tenant context unless you are certain it matches the current host.
2. On a shared login screen, send one organization hint when the user selected an organization beforehand.
3. Never send conflicting tenant hints together.

Recommended payload builder:

```ts
type ContactLoginPayload = {
  email: string;
  password: string;
  organization_id?: string;
  organization_subdomain?: string;
  organization_domain?: string;
};

function buildContactLoginPayload(input: {
  email: string;
  password: string;
  organizationId?: string | null;
  organizationSubdomain?: string | null;
  organizationDomain?: string | null;
}): ContactLoginPayload {
  const payload: ContactLoginPayload = {
    email: input.email.trim(),
    password: input.password,
  };

  if (input.organizationId) {
    payload.organization_id = input.organizationId;
  } else if (input.organizationSubdomain) {
    payload.organization_subdomain = input.organizationSubdomain;
  } else if (input.organizationDomain) {
    payload.organization_domain = input.organizationDomain;
  }

  return payload;
}
```

## 3. Login Flow

Request:

```http
POST /contact-auth/login
Content-Type: application/json
```

```json
{
  "email": "parent@example.com",
  "password": "StrongPass123!",
  "organization_subdomain": "demo-school"
}
```

Expected frontend behavior:

1. Submit credentials with `withCredentials: true`.
2. On success, allow the backend to set `pf_contact_token`.
3. Immediately call `GET /contact-auth/me` to bootstrap the logged-in contact.
4. Store only the contact profile in frontend state.
5. Redirect to the contact dashboard after `GET /contact-auth/me` succeeds.

Suggested implementation:

```ts
async function loginContact(payload: ContactLoginPayload) {
  await client.post('/contact-auth/login', payload);
  const meResponse = await client.get('/contact-auth/me');
  return meResponse.data;
}
```

## 4. Bootstrap on Page Load

On app startup for protected contact pages:

1. Call `GET /contact-auth/me`.
2. If it succeeds, hydrate the contact store.
3. If it returns `401`, clear contact state and redirect to the contact login page.

Suggested bootstrap pattern:

```ts
async function bootstrapContactSession() {
  try {
    const response = await client.get('/contact-auth/me');
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      return null;
    }
    throw error;
  }
}
```

## 5. Logout Flow

- Call `POST /contact-auth/logout`.
- Clear local contact state after the request completes.
- Redirect back to the login screen or public form entry point.

```ts
async function logoutContact() {
  try {
    await client.post('/contact-auth/logout');
  } finally {
    clearContactStore();
    router.push('/login');
  }
}
```

## 6. Password Setup and Reset

First-time setup:

- Use `POST /contact-auth/set-password` with `{ token, password }`.
- After success, redirect the contact to the normal login screen.

Forgot password request:

- Use `POST /contact-auth/reset/request`.
- Include tenant context on shared screens.
- Show a generic success message regardless of whether the contact exists.

Reset confirm:

- Use `POST /contact-auth/reset/confirm` with `{ token, password }`.

## 7. Error Handling Rules

- `400`: show a form-level validation message.
- `401`: show invalid-credentials or session-expired messaging.
- `403`: treat as access restriction, especially for tenant mismatch or disabled access.
- `429`: show a retry-later message.

Do not expose backend internals in the UI. Prefer short messages such as:

- Invalid email or password
- This account does not have access to this organization
- Your session has expired. Please sign in again

## 8. Minimal Contact Auth Store Shape

```ts
type ContactUser = {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  organization_id: string;
};

type ContactAuthState = {
  user: ContactUser | null;
  isLoading: boolean;
  error: string | null;
  login: (payload: ContactLoginPayload) => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
  logout: () => Promise<void>;
};
```

## 9. Recommended FE Sequence

1. Build a dedicated contact login page instead of reusing the admin login page.
2. Create a dedicated contact auth client wrapper around `/contact-auth/*` routes.
3. Bootstrap protected contact pages with `GET /contact-auth/me`.
4. Keep admin auth state and contact auth state separate.
5. Route contact logout through `POST /contact-auth/logout` only.