const TOKEN_KEY = "zarierp_token";

export async function logActivity(description: string): Promise<void> {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    await fetch("/api/settings/activity-logs/action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ description, method: "GET", url: "/client/download" }),
    });
  } catch {
  }
}
