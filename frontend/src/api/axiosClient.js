import axios from "axios";

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

let logoutHandler = null;
export function setLogoutHandler(fn) {
  logoutHandler = fn;
}

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (
      err.response?.status === 401 &&
      !err.config?.url?.includes("/auth/me") &&
      !err.config?.url?.includes("/auth/login")
    ) {
      if (logoutHandler) logoutHandler();
    }
    return Promise.reject(err);
  }
);

export default apiClient;
