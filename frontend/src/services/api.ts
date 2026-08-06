const API_URL = "http://localhost:8000";

export async function getWelcomeMessage() {
  const response = await fetch(API_URL);

  const data = await response.json();

  return data;
}