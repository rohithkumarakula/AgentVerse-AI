import Navbar from "../../components/Navbar/Navbar";
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

                            <p>
                                Your personal AI assistant for career and professional growth.
                                Improve your resume, prepare for interviews and get career
                                guidance.
                            </p>
                        </div>

                        <div className="about-card">
                            <div className="about-card-icon">📚</div>

                            <h2>StudyAI</h2>

                            <p>
                                Learn smarter with AI-powered study assistance. Understand
                                difficult topics, create study plans and improve your learning.
                            </p>
                        </div>

                        <div className="about-card">
                            <div className="about-card-icon">🧠</div>

                            <h2>LifeAI</h2>

                            <p>
                                Organize your goals, build better routines, track your habits
                                and improve your everyday productivity.
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
        </>
    );
}

export default About;