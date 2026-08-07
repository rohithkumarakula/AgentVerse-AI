import "./Navbar.css";
import { NavLink } from "react-router-dom";

function Navbar() {
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
          <a href="#">About</a>
        </li>
      </ul>

      <button className="login-btn">Get Started</button>
    </nav>
  );
}

export default Navbar;