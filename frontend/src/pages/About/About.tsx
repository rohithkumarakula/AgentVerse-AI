import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import "./About.css";

function About() {
    return (
        <>
            <Navbar />

            <div className="about-page">
                <div className="about-container">

                    <div className="about-icon">
                        🚀
                    </div>

                    <h1>About AgentVerse AI</h1>

                    <p className="about-intro">
                        AgentVerse AI is an intelligent platform that brings multiple
                        AI assistants together in one place to help you with different
                        areas of your life.
                    </p>

                    <div className="about-cards">

                        <div className="about-card">
                            <div className="about-card-icon">🤖</div>

                            <h2>TailorAI</h2>

                            <span className="about-card-category">Career & Placement</span>

                            <p>
                                Personal AI assistant for career and professional growth. Get help with resumes,
                                interviews, career planning and professional guidance.
                            </p>
                        </div>

                        <div className="about-card">
                            <div className="about-card-icon">📚</div>

                            <h2>StudyAI</h2>

                            <span className="about-card-category">Education</span>

                            <p>
                                AI-powered learning assistant for students. Explain difficult topics, create study
                                plans, help with revision and improve learning.
                            </p>
                        </div>

                        <div className="about-card">
                            <div className="about-card-icon">🧠</div>

                            <h2>LifeAI</h2>

                            <span className="about-card-category">Productivity</span>

                            <p>
                                Personal productivity and life assistant for organizing goals, building routines,
                                tracking habits and improving productivity.
                            </p>
                        </div>

                        <div className="about-card">
                            <div className="about-card-icon">💻</div>
                            <h2>CodeAI</h2>
                            <span className="about-card-category">Programming</span>
                            <p>
                                AI coding assistant for software development. Explain code, debug problems, generate
                                code, explain programming concepts and assist with development.
                            </p>
                        </div>

                        <div className="about-card">
                            <div className="about-card-icon">💰</div>
                            <h2>FinanceAI</h2>
                            <span className="about-card-category">Finance</span>
                            <p>
                                Personal finance and financial education assistant for budgeting, saving, expenses
                                and money-management topics. Provides general education, not professional advice.
                            </p>
                        </div>

                        <div className="about-card">
                            <div className="about-card-icon">🏋️</div>
                            <h2>HealthAI</h2>
                            <span className="about-card-category">Health & Fitness</span>
                            <p>
                                Fitness, nutrition and wellness assistant offering general guidance on exercise and
                                healthy habits. It is not a doctor or a substitute for medical advice.
                            </p>
                        </div>

                    </div>

                    <div className="about-mission">
                        <h2>Our Mission</h2>

                        <p>
                            Our goal is to make AI simple, useful and accessible by bringing
                            specialized AI assistants together on one unified platform.
                        </p>
                    </div>

                    <div className="about-tagline">
                        One Platform. Infinite AI Agents.
                    </div>

                </div>
            </div>

            <Footer />
        </>
    );
}

export default About;