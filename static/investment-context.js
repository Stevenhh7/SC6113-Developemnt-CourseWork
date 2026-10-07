const projectId = document.body.dataset.investmentId || "";
export const overviewPath = projectId ? "/investments/" + projectId : "/";
export const activityPath = projectId ? overviewPath + "/activity" : "/activity";
export function scopedApi(path) {
  return projectId ? path + (path.includes("?") ? "&" : "?") + "investment=" + encodeURIComponent(projectId) : path;
}
