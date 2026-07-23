import { useNavigate } from 'react-router-dom';

export default function TestDashboard() {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Later, you'll clear tokens from local storage here
    navigate('/login');
  };

  return (
    <div style={{ padding: '50px', textAlign: 'center' }}>
      <h1>🎉 You made it to the Test Dashboard!</h1>
      <p>You have successfully navigated through the auth flow.</p>
      <button onClick={handleLogout} style={{ padding: '10px 20px', marginTop: '20px', cursor: 'pointer' }}>
        Logout
      </button>
    </div>
  );
}