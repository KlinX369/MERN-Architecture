// Auth/authApi.js
//
// Shared authentication API helper.
// Uses the existing backend CSRF protection and HttpOnly
// authentication cookies.
//
// No access/refresh token is stored in localStorage.


export const BACKEND_URL =
  (
    import.meta.env.VITE_BACKEND_URL ||
    'http://localhost:5000'
  ).replace(/\/$/, '');


let csrfTokenCache = null;
let csrfRequest = null;


// =========================================================
// GET CSRF TOKEN
// =========================================================

export async function getCsrfToken(
  forceRefresh = false
) {

  if (
    csrfTokenCache &&
    !forceRefresh
  ) {
    return csrfTokenCache;
  }


  if (
    csrfRequest &&
    !forceRefresh
  ) {
    return csrfRequest;
  }


  csrfRequest =
    fetch(
      `${BACKEND_URL}/api/auth/csrf`,
      {
        method: 'GET',

        credentials: 'include',

        headers: {
          Accept:
            'application/json'
        }
      }
    )
      .then(
        async (response) => {

          const data =
            await response
              .json()
              .catch(
                () => ({})
              );


          if (
            !response.ok ||
            !data.csrfToken
          ) {

            throw new Error(
              data.message ||
              'Unable to initialize secure authentication.'
            );
          }


          csrfTokenCache =
            data.csrfToken;


          return csrfTokenCache;
        }
      )
      .finally(() => {

        csrfRequest =
          null;
      });


  return csrfRequest;
}


// =========================================================
// SECURE FETCH
// =========================================================

export async function secureFetch(
  path,
  options = {}
) {

  const method =
    String(
      options.method ||
      'GET'
    ).toUpperCase();


  const headers =
    new Headers(
      options.headers ||
      {}
    );


  /*
   * Every state-changing request requires CSRF.
   */
  if (
    method !== 'GET' &&
    method !== 'HEAD' &&
    method !== 'OPTIONS'
  ) {

    const token =
      await getCsrfToken();


    headers.set(
      'X-CSRF-Token',
      token
    );
  }


  if (
    !headers.has('Accept')
  ) {

    headers.set(
      'Accept',
      'application/json'
    );
  }


  const response =
    await fetch(
      `${BACKEND_URL}${path}`,
      {
        ...options,

        method,

        headers,

        credentials:
          'include'
      }
    );


  /*
   * If CSRF was stale, refresh it once and retry.
   */
  if (
    response.status === 403 &&
    method !== 'GET' &&
    method !== 'HEAD' &&
    method !== 'OPTIONS'
  ) {

    const data =
      await response
        .clone()
        .json()
        .catch(
          () => ({})
        );


    const message =
      String(
        data.message ||
        ''
      ).toLowerCase();


    if (
      message.includes('csrf')
    ) {

      const freshToken =
        await getCsrfToken(
          true
        );


      headers.set(
        'X-CSRF-Token',
        freshToken
      );


      return fetch(
        `${BACKEND_URL}${path}`,
        {
          ...options,

          method,

          headers,

          credentials:
            'include'
        }
      );
    }
  }


  return response;
}


// =========================================================
// CLEAR CLIENT SECURITY STATE
// =========================================================

export function clearAuthClientState() {

  csrfTokenCache =
    null;

  csrfRequest =
    null;
}