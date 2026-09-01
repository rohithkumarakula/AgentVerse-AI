import { Routes, Route } from "react-router-dom";

import Home from "./pages/Home/Home";
import Agents from "./pages/Agents/Agents";
import Features from "./pages/Features/Features";
import NotFound from "./pages/NotFound/NotFound";
import TailorAI from "./pages/TailorAI/TailorAI";
import StudyAI from "./pages/studyAI/studyAI";
import LifeAI from "./pages/LifeAI/LifeAI";
import CareerProfile from "./components/careerProfile/careerProfile";
import About from "./pages/About/About";
import CodeAI from "./pages/CodeAI/CodeAI";
import FinanceAI from "./pages/FinanceAI/FinanceAI";
import HealthAI from "./pages/HealthAI/HealthAI";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />

      <Route path="/agents" element={<Agents />} />

      <Route path="/features" element={<Features />} />

      <Route path="/tailor-ai" element={<TailorAI />} />

      <Route path="/study-ai" element={<StudyAI />} />

      <Route path="/life-ai" element={<LifeAI />} />

      <Route path="/code-ai" element={<CodeAI />} />

      <Route path="/finance-ai" element={<FinanceAI />} />

      <Route path="/health-ai" element={<HealthAI />} />

      <Route
        path="/career-profile"
        element={<CareerProfile />}
      />

      <Route path="/about" element={<About />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;