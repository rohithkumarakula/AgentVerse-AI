/* =========================================================
   AGENTVERSE AI — REST HELPERS
   ---------------------------------------------------------
   Thin wrappers over the shared client in apiClient.ts so
   every caller gets the same base URL, timeout and error
   handling.
   ========================================================= */

import { getJson, postJson } from "./apiClient";

export { API_URL, ApiError, toUserMessage } from "./apiClient";

export type CareerProfileData = {
  skills: string;
  targetRole: string;
  experience: string;
  timeline: string;
  salaryGoal: string;
};

export function getWelcomeMessage() {
  return getJson<{
    message: string;
    status: string;
  }>("");
}

export function saveCareerProfile(
  profile: CareerProfileData
) {
  return postJson<{
    message: string;
    profile: CareerProfileData;
  }>("/career-profile", profile);
}

export function getCareerAIAnalysis(
  profile: CareerProfileData
) {
  return postJson<{
    type: string;
    reply: string;
  }>("/career-ai", { profile });
}
