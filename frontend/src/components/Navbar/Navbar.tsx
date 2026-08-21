import "./Navbar.css";
import { NavLink, useNavigate } from "react-router-dom";

function Navbar() {
  const navigate = useNavigate();

  return (
    <nav className="navbar">
      <h1 className="logo">🚀 AgentVerse AI</h1>

      <ul className="nav-links">
        <li>
          <NavLink to="/">Home</NavLink>
        </li>

        <li>
          <NavLink to="/agents">Agents</NavLink>
        </li>

        <li>
          <NavLink to="/features">Features</NavLink>
        </li>

        <li>
          <NavLink to="/career-profile">
            Career Profile
          </NavLink>
        </li>

        <li>
          <NavLink to="/about">About</NavLink>
        </li>
      </ul>

      <button
        className="login-btn"
        onClick={() => navigate("/agents")}
      >
        Get Started
      </button>
    </nav>
  );
}

export default Navbar;