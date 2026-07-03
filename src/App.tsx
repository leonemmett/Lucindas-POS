import { useAuth } from './lib/AuthContext'
import { Login } from './components/Login'
import './App.css'

function App() {
  const { session, loading, signOut } = useAuth()

  if (loading) {
    return <div className="app-loading" />
  }

  if (!session) {
    return <Login />
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Lucinda's POS</h1>
        <div className="app-header-user">
          <span>{session.user.email}</span>
          <button type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>
      <main className="app-main">
        <p>Signed in. Dashboard coming next.</p>
      </main>
    </div>
  )
}

export default App
