import "./Navbar.css";

function Navbar() {
  return (
    <nav className="navbar">
      <div className="logo">🚀 AgentVerse AI</div>

      <ul className="nav-links">
        <li>Home</li>
        <li>Agents</li>
        <li>Features</li>
        <li>About</li>
      </ul>

      <button className="login-btn">Get Started</button>
    </nav>
  );
}

export default Navbar;