  // src/services/api.ts
  import AsyncStorage from '@react-native-async-storage/async-storage';

  const BASE_URL = 'https://librium.onrender.com/api';

  let authToken: string | null = null;

  export const setToken = async (token: string) => {
    authToken = token;
    await AsyncStorage.setItem('token', token);
  };

  export const loadToken = async () => {
    authToken = await AsyncStorage.getItem('token');
  };

  export const getToken = () => authToken;

  export const clearToken = async () => {
    authToken = null;
    await AsyncStorage.removeItem('token');
  };

  const headers = (extra: Record<string, string> = {}) => ({
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...extra,
  });

  const req = async (method: string, path: string, body?: any) => {
    // ✅ CRITICAL: Always get fresh token from storage
    const token = await AsyncStorage.getItem('token');
    const isFormData = body instanceof FormData;

    const requestHeaders: Record<string, string> = isFormData
      ? (token ? { Authorization: `Bearer ${token}` } : {})
      : {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

    console.log(`📡 ${method} ${path} - Token exists:`, !!token);

    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: requestHeaders,
      body: body
        ? isFormData
          ? body
          : JSON.stringify(body)
        : undefined,
    });

    const text = await res.text();
    let data;

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { detail: text || 'Unexpected server response.' };
    }

    if (!res.ok) {
      console.error(`API Error ${method} ${path}:`, { status: res.status, data });
      throw { status: res.status, data };
    }

    return data;
  };

  // ── Auth ──────────────────────────────────────────────────────
  export const login = (email: string, password: string) =>
    req('POST', '/auth/jwt/create/', { email, password });

  export const getMe = () => req('GET', '/users/me/');

  export const registerUser = (payload: any) =>
    req('POST', '/auth/users/', payload);

  export const activateUser = (uid: string, token: string) =>
    req('POST', '/auth/users/activation/', { uid, token });

  export const updateMe = (data: any) =>
    req('PATCH', '/users/me/', data);

  export const changePassword = (data: {
    old_password:     string;
    new_password:     string;
    confirm_password: string;
  }) => req('POST', '/users/me/change-password/', data);

  // ── Dashboard ─────────────────────────────────────────────────
  export const getDashboard = () => req('GET', '/library/dashboard/');

  // ── Users ─────────────────────────────────────────────────────
  export const getUsers   = ()            => req('GET',    '/users/');
  export const getUser    = (id: number)  => req('GET',    `/users/${id}/`);
  export const createUser = (data: any)   => req('POST',   '/users/', data);
  export const updateUser = (id: number, data: any) => req('PATCH', `/users/${id}/`, data);
  export const deleteUser = (id: number)  => req('DELETE', `/users/${id}/`);

  // ── Books ─────────────────────────────────────────────────────
  export const getBooks   = (params?: string) => req('GET', `/library/books/${params ? `?${params}` : ''}`);
  export const getBook    = (id: number)      => req('GET', `/library/books/${id}/`);
  export const createBook = (data: any)       => req('POST',   '/library/books/', data);
  export const updateBook = (id: number, data: any) => req('PATCH', `/library/books/${id}/`, data);
  export const deleteBook = (id: number)      => req('DELETE', `/library/books/${id}/`);

  // ── Authors ───────────────────────────────────────────────────
  export const getAuthors   = ()           => req('GET',  '/library/authors/');
  export const getAuthor    = (id: number) => req('GET',  `/library/authors/${id}/`);
  export const createAuthor = (data: any)  => req('POST', '/library/authors/', data);
  export const updateAuthor = (id: number, data: any) => req('PATCH', `/library/authors/${id}/`, data);
  export const deleteAuthor = (id: number) => req('DELETE', `/library/authors/${id}/`);

  // ── Categories ────────────────────────────────────────────────
  export const getCategories  = ()           => req('GET',  '/library/categories/');
  export const createCategory = (data: any)  => req('POST', '/library/categories/', data);
  export const updateCategory = (id: number, data: any) => req('PATCH', `/library/categories/${id}/`, data);
  export const deleteCategory = (id: number) => req('DELETE', `/library/categories/${id}/`);

  // ── Departments ───────────────────────────────────────────────
  export const getDepartments  = ()           => req('GET',  '/library/departments/');
  export const createDepartment = (data: any) => req('POST', '/library/departments/', data);
  export const updateDepartment = (id: number, data: any) => req('PATCH', `/library/departments/${id}/`, data);
  export const deleteDepartment = (id: number) => req('DELETE', `/library/departments/${id}/`);

  // ── Semesters ─────────────────────────────────────────────────
  export const getSemesters      = ()           => req('GET',   '/library/semesters/');
  export const createSemester    = (data: any)  => req('POST',  '/library/semesters/', data);
  export const updateSemester    = (id: number, data: any) => req('PATCH', `/library/semesters/${id}/`, data);
  export const deleteSemester    = (id: number) => req('DELETE', `/library/semesters/${id}/`);
  export const setActiveSemester = (id: number) => req('PATCH',  `/library/semesters/${id}/set-active/`);

  // ── Borrow Requests ───────────────────────────────────────────
  export const getBorrowRequests    = (status?: string) =>
    req('GET', `/library/borrow-requests/${status ? `?status=${status}` : ''}`);
  export const getBorrowRequest     = (id: number) => req('GET', `/library/borrow-requests/${id}/`);
  export const approveBorrowRequest = (id: number, notes?: string) =>
    req('POST', `/library/borrow-requests/${id}/approve/`, { notes });
  export const rejectBorrowRequest  = (id: number, notes?: string) =>
    req('POST', `/library/borrow-requests/${id}/reject/`, { notes });
  export const cancelBorrowRequest  = (id: number) =>
    req('DELETE', `/library/borrow-requests/${id}/`);
  export const createBorrowRequest  = (data: { book: number }) =>
    req('POST', '/library/borrow-requests/', data);

  // ── Loans ─────────────────────────────────────────────────────
  export const getLoans      = ()           => req('GET',    '/library/loans/');
  export const getLoan       = (id: number) => req('GET',    `/library/loans/${id}/`);
  export const createLoan    = (data: any)  => req('POST',   '/library/loans/', data);
  export const deleteLoan    = (id: number) => req('DELETE', `/library/loans/${id}/`);
  export const requestReturn = (loanId: number, notes?: string) =>
    req('POST', '/library/loans/return-request/', { loan_id: loanId, notes });
  export const verifyReturn  = (loanId: number, status: 'verified' | 'rejected' | 'disputed', notes?: string) =>
    req('POST', '/library/loans/return-verify/', { loan_id: loanId, status, notes });
  export const getLoansBySemester = (semesterId: number) =>
    req('GET', `/library/loans/by-semester/?semester=${semesterId}`);


  // ── Reservations ──────────────────────────────────────────────
  export const getReservations   = ()           => req('GET',    '/library/reservations/');
  export const getReservation    = (id: number) => req('GET',    `/library/reservations/${id}/`);
  export const createReservation = (data: any)  => req('POST',   '/library/reservations/', data);
  export const cancelReservation = (id: number) => req('DELETE', `/library/reservations/${id}/`);
  export const fulfillReservation = (id: number) => req('POST',   `/library/reservations/${id}/fulfill/`);

  
  // ── Fines ─────────────────────────────────────────────────────
  export const getFines = ()           => req('GET',  '/library/fines/');
  export const getFine  = (id: number) => req('GET',  `/library/fines/${id}/`);
  export const payFine  = (id: number) => req('POST', `/library/fines/${id}/pay/`);