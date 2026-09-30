import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate
} from 'react-router-dom';

import Login from './Auth/Login';
import Register from './Auth/Register';
import OtpVerification from './Auth/OtpVerification';
import ForgotPassword from './Auth/ForgotPassword';

// Role-Specific Dashboards
import AdminDashboard from './pages/admin/Dashboard';
import InstructorDashboard from './pages/instructor/Dashboard';
import StudentDashboard from './pages/student/Dashboard';

// Security Component
import ProtectedRoute from './components/ProtectedRoute';

import './App.css';


function Unauthorized() {

  return (
    <div
      style={{
        textAlign: 'center',
        marginTop: '100px',
        fontFamily: "'Inter', sans-serif"
      }}
    >

      <h1
        style={{
          color: '#ef4444',
          fontSize: '36px'
        }}
      >
        403 - Access Denied
      </h1>

      <p
        style={{
          color: '#64748b'
        }}
      >
        Your assigned role does not have permission to view this page.
      </p>

      <button
        onClick={() =>
          window.history.back()
        }
        style={{
          marginTop: '20px',
          padding: '10px 20px',
          cursor: 'pointer',
          backgroundColor: '#2563eb',
          color: '#fff',
          border: 'none',
          borderRadius: '8px'
        }}
      >
        Go Back
      </button>

    </div>
  );
}


// =========================================================
// ROLE-BASED REDIRECT
// =========================================================

function RoleBasedRedirect() {

  const storedUser =
    localStorage.getItem(
      'user_data'
    );

  let user = null;

  try {

    user =
      storedUser
        ? JSON.parse(storedUser)
        : null;

  } catch {

    localStorage.removeItem(
      'user_data'
    );

    localStorage.removeItem(
      'jwt_token'
    );

    user = null;
  }


  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }


  switch (user.role) {

    case 'admin':
      return (
        <Navigate
          to="/admin/dashboard"
          replace
        />
      );

    case 'instructor':
    case 'tutor':
      return (
        <Navigate
          to="/instructor/dashboard"
          replace
        />
      );

    case 'student':
      return (
        <Navigate
          to="/student/dashboard"
          replace
        />
      );

    default:
      return (
        <Navigate
          to="/login"
          replace
        />
      );
  }
}


// =========================================================
// APP
// =========================================================

function App() {

  return (
    <Router>

      <Routes>

        {/* ROOT */}

        <Route
          path="/"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />


        {/* PUBLIC AUTH */}

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        <Route
          path="/otp-verification"
          element={<OtpVerification />}
        />

        <Route
          path="/forgot-password"
          element={<ForgotPassword />}
        />

        <Route
          path="/unauthorized"
          element={<Unauthorized />}
        />


        {/* GENERAL DASHBOARD REDIRECT */}

        <Route
          path="/dashboard"
          element={
            <RoleBasedRedirect />
          }
        />


        {/* ADMIN */}

        <Route
          element={
            <ProtectedRoute
              allowedRoles={[
                'admin'
              ]}
            />
          }
        >
          <Route
            path="/admin/dashboard"
            element={
              <AdminDashboard />
            }
          />
        </Route>


        {/* INSTRUCTOR + TUTOR + ADMIN */}

        <Route
          element={
            <ProtectedRoute
              allowedRoles={[
                'instructor',
                'tutor',
                'admin'
              ]}
            />
          }
        >
          <Route
            path="/instructor/dashboard"
            element={
              <InstructorDashboard />
            }
          />
        </Route>


        {/* STUDENT + INSTRUCTOR + TUTOR + ADMIN */}

        <Route
          element={
            <ProtectedRoute
              allowedRoles={[
                'student',
                'instructor',
                'tutor',
                'admin'
              ]}
            />
          }
        >
          <Route
            path="/student/dashboard"
            element={
              <StudentDashboard />
            }
          />
        </Route>


        {/* 404 */}

        <Route
          path="*"
          element={
            <div
              style={{
                textAlign: 'center',
                marginTop: '100px'
              }}
            >
              <h1>
                404 - Page Not Found
              </h1>
            </div>
          }
        />

      </Routes>

    </Router>
  );
}


export default App;