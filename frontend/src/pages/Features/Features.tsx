import "./Features.css";

import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";

function Features() {
  const features = [
    {
      icon: "🤖",
      title: "Multiple AI Agents",
      description: "Access different AI assistants from one platform.",
    },
    {
      icon: "⚡",
      title: "Fast Responses",
      description: "Powered by modern AI models for quick answers.",
    },
    {
      icon: "🔒",
      title: "Secure",
      description: "Your conversations remain safe and private.",
    },
    {
      icon: "🌐",
      title: "One Platform",
      description: "Manage all your AI assistants in one place.",
    },
    {
      icon: "📱",
      title: "Responsive Design",
      description: "Works seamlessly on desktop, tablet, and mobile.",
    },
    {
      icon: "🚀",
      title: "Future Ready",
      description: "Built with React, TypeScript, and FastAPI.",
    },
  ];

  return (
    <>
      <Navbar />

      <section className="features-page">
        <h1>Platform Features</h1>
        <p>Everything you need to work with AI efficiently.</p>

        <div className="features-grid">
          {features.map((feature) => (
            <div className="feature-card" key={feature.title}>
              <div className="feature-icon">{feature.icon}</div>

              <h3>{feature.title}</h3>

              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </>
  );
}

export default Features;