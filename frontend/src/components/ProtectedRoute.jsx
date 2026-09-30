// src/components/ProtectedRoute.jsx
import { Navigate, Outlet } from 'react-router-dom';

export default function ProtectedRoute({ allowedRoles }) {
  const token = localStorage.getItem('jwt_token');
  const storedUser = localStorage.getItem('user_data');
  const user = storedUser ? JSON.parse(storedUser) : null;

  // If there is no token or user data, redirect to login
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  // If the route has specific allowed roles and the user's role isn't one of them, deny access
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // If authorized, render the requested child route (the specific Dashboard)
  return <Outlet />;
}