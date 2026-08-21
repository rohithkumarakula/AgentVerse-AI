import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./CareerProfile.css";

import Navbar from "../Navbar/Navbar";

import {
  saveCareerProfile,
  getCareerAIAnalysis,
} from "../../services/api";

type CareerProfileData = {
  skills: string;
  targetRole: string;
  experience: string;
  timeline: string;
  salaryGoal: string;
};

const emptyProfile: CareerProfileData = {
  skills: "",
  targetRole: "",
  experience: "",
  timeline: "",
  salaryGoal: "",
};

function CareerProfile() {
  const [profile, setProfile] = useState<CareerProfileData>(() => {
    const saved = localStorage.getItem(
      "agentverse-career-profile"
    );

    if (!saved) {
      return emptyProfile;
    }

    try {
      const parsed = JSON.parse(saved);

      return {
        skills:
          typeof parsed.skills === "string"
            ? parsed.skills
            : "",

        targetRole:
          typeof parsed.targetRole === "string"
            ? parsed.targetRole
            : "",

        experience:
          typeof parsed.experience === "string"
            ? parsed.experience
            : "",

        timeline:
          typeof parsed.timeline === "string"
            ? parsed.timeline
            : "",

        salaryGoal:
          typeof parsed.salaryGoal === "string"
            ? parsed.salaryGoal
            : "",
      };
    } catch {
      localStorage.removeItem(
        "agentverse-career-profile"
      );

      return emptyProfile;
    }
  });

  const [analysis, setAnalysis] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  function handleChange(
    field: keyof CareerProfileData,
    value: string
  ) {
    setProfile((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function handleSave() {
    try {
      localStorage.setItem(
        "agentverse-career-profile",
        JSON.stringify(profile)
      );

      await saveCareerProfile(profile);

      alert("Career profile saved!");
    } catch (error) {
      console.error(
        "Career profile save failed:",
        error
      );

      alert("Failed to save career profile.");
    }
  }

  async function handleAnalyze() {
    if (analyzing) return;

    if (
      !profile.skills.trim() ||
      !profile.targetRole.trim()
    ) {
      alert(
        "Please enter your current skills and target role first."
      );

      return;
    }

    setAnalyzing(true);
    setAnalysis("");

    try {
      const data = await getCareerAIAnalysis(profile);

      setAnalysis(
        data.reply ||
        "Sorry, I couldn't generate your career analysis."
      );
    } catch (error) {
      console.error(
        "CareerAI analysis failed:",
        error
      );

      setAnalysis(
        "Sorry, something went wrong while generating your career analysis. Please make sure the backend server is running."
      );
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <>
      <Navbar />

      <div className="career-profile">

        <div className="career-profile-header">
          <h2>Career Profile</h2>

          <p>
            Tell CareerAI about your career goals and get a
            personalized career roadmap.
          </p>
        </div>

        <div className="career-profile-form">

          <div className="profile-field">
            <label>Current Skills</label>

            <input
              type="text"
              placeholder="e.g. HTML, CSS, Python"
              value={profile.skills}
              onChange={(e) =>
                handleChange(
                  "skills",
                  e.target.value
                )
              }
            />
          </div>

          <div className="profile-field">
            <label>Target Role</label>

            <input
              type="text"
              placeholder="e.g. Software Developer"
              value={profile.targetRole}
              onChange={(e) =>
                handleChange(
                  "targetRole",
                  e.target.value
                )
              }
            />
          </div>

          <div className="profile-field">
            <label>Experience Level</label>

            <select
              value={profile.experience}
              onChange={(e) =>
                handleChange(
                  "experience",
                  e.target.value
                )
              }
            >
              <option value="">
                Select level
              </option>

              <option value="Beginner">
                Beginner
              </option>

              <option value="Intermediate">
                Intermediate
              </option>

              <option value="Advanced">
                Advanced
              </option>
            </select>
          </div>

          <div className="profile-field">
            <label>Timeline</label>

            <input
              type="text"
              placeholder="e.g. 6 months"
              value={profile.timeline}
              onChange={(e) =>
                handleChange(
                  "timeline",
                  e.target.value
                )
              }
            />
          </div>

          <div className="profile-field">
            <label>Target Salary</label>

            <input
              type="text"
              placeholder="e.g. ₹6 LPA"
              value={profile.salaryGoal}
              onChange={(e) =>
                handleChange(
                  "salaryGoal",
                  e.target.value
                )
              }
            />
          </div>

          <div className="career-profile-buttons">

            <button
              className="save-profile-btn"
              onClick={handleSave}
            >
              Save Career Profile
            </button>

            <button
              className="analyze-career-btn"
              onClick={handleAnalyze}
              disabled={analyzing}
            >
              {analyzing
                ? "Analyzing..."
                : "Analyze My Career"}
            </button>

          </div>
        </div>

        {analyzing && (
          <div className="career-analysis">

            <div className="career-analysis-header">
              <h2>CareerAI</h2>
            </div>

            <div className="career-analysis-loading">
              Analyzing your career profile...
            </div>

          </div>
        )}

        {analysis && !analyzing && (
          <div className="career-analysis">

            <div className="career-analysis-header">
              <h2>CareerAI Analysis</h2>

              <p>
                Personalized guidance based on your
                career profile.
              </p>
            </div>

            <div className="career-analysis-content">

              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
              >
                {analysis}
              </ReactMarkdown>

            </div>

          </div>
        )}

      </div>
    </>
  );
}

export default CareerProfile;