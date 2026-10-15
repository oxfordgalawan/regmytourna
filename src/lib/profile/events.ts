export const PROFILE_UPDATED_EVENT = "rmt-profile-updated";

export function notifyProfileUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
  }
}
