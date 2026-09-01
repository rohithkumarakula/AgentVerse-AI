const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function getWelcomeMessage() {
  const response = await fetch(API_URL);

  const data = await response.json();

  return data;
}

export type CareerProfileData = {
  skills: string;
  targetRole: string;
  experience: string;
  timeline: string;
  salaryGoal: string;
};

export async function saveCareerProfile(
  profile: CareerProfileData
) {
  const response = await fetch(`${API_URL}/career-profile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(profile),
  });

  if (!response.ok) {
    throw new Error("Failed to save career profile");
  }

  return response.json();
}

export async function getCareerAIAnalysis(
  profile: CareerProfileData
) {
  const response = await fetch(`${API_URL}/career-ai`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      profile,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to generate career analysis");
  }

  return response.json();
}