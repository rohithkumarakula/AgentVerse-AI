import { Routes, Route } from "react-router-dom";

import Home from "./pages/Home/Home";
import Agents from "./pages/Agents/Agents";
import Features from "./pages/Features/Features";
import NotFound from "./pages/NotFound/NotFound";
import TailorAI from "./pages/TailorAI/TailorAI";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/agents" element={<Agents />} />
      <Route path="/features" element={<Features />} />
      <Route path="/tailor-ai" element={<TailorAI />} />
      <Route path="*" element={<NotFound />} />
      
    </Routes>
  );
}

export default App;