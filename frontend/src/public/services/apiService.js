import axios from "axios";

function getErrorMessage(error) {
  const data = error.response?.data;

  if (data && typeof data === "object") {
    const apiError = data.error;

    if (apiError) {
      // Gestion spécifique des ZodError
      if (apiError.name === "ZodError") {
        try {
          const details = typeof apiError.message === "string"
            ? JSON.parse(apiError.message)
            : apiError.message;

          if (Array.isArray(details)) {
            return details
              .map((item) => `${item.path.join(".")}: ${item.message}`)
              .join("\n");
          }
        } catch (e) {
          console.error("Erreur de parsing ZodError:", e);
        }
      }

      return apiError.message || apiError;
    }
  }

  return error.message || "Une erreur inconnue est survenue";
}

let refreshPromise = null;

const apiClient = axios.create({
  baseURL: globalThis.APP_CONFIG.API_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

export const apiService = {
  connectedUser: JSON.parse(sessionStorage.getItem("user")) || null,
  isAuthenticated: !!sessionStorage.getItem("user"),

  async login(username, password) {
    try {
      const res = await apiClient.post("auth/login", {
        username: username,
        password: password,
      });
      this.connectedUser = res.data.user;
      this.isAuthenticated = true;

      sessionStorage.setItem("user", JSON.stringify(res.data.user));
      globalThis.dispatchEvent(
        new CustomEvent("auth-change", { detail: this.connectedUser }),
      );

      return { success: true, user: res.data.user };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async logout() {
    try {
      await apiClient.post("auth/logout");
    } finally {
      this.connectedUser = null;
      this.isAuthenticated = false;
      globalThis.dispatchEvent(
        new CustomEvent("auth-change", { detail: this.connectedUser }),
      );
      sessionStorage.removeItem("user");
    }
    return { success: true };
  },

  async refresh() {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
      try {
        const res = await apiClient.post("/auth/token/refresh");
        this.isAuthenticated = true;
        this.connectedUser = res.data.user;
        sessionStorage.setItem("user", JSON.stringify(res.data.user));
        globalThis.dispatchEvent(
          new CustomEvent("auth-change", { detail: this.connectedUser }),
        );
        return { success: true, user: res.data.user };
      } catch (error) {
        this.isAuthenticated = false;
        this.connectedUser = null;
        sessionStorage.removeItem("user");
        globalThis.dispatchEvent(
          new CustomEvent("auth-change", { detail: this.connectedUser }),
        );
        return { success: false, error: getErrorMessage(error) };
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  },

  async getAll(resource, refreshAllowed = true) {
    try {
      const res = await apiClient.get(resource);
      return {
        success: true,
        data: res.data?.results || res.data,
        next: res.data?.next,
      };
    } catch (error) {
      if (error.response?.status === 401 && refreshAllowed) {
        const refreshed = await this.refresh();
        if (refreshed.success) return this.getAll(resource, false);
      }
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async getById(resource, id, refreshAllowed = true) {
    try {
      const res = await apiClient.get(`${resource}/${id}/`);
      return { success: true, data: res.data };
    } catch (error) {
      if (error.response?.status === 401 && refreshAllowed) {
        const refreshed = await this.refresh();
        if (refreshed.success) return this.getById(resource, id, false);
      }
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async createResource(resource, data, refreshAllowed = true) {
    try {
      const headers = data instanceof FormData
        ? { "Content-Type": undefined }
        : {};

      const res = await apiClient.post(`${resource}/`, data, { headers });
      return { success: true, data: res.data };
    } catch (error) {
      if (error.response?.status === 401 && refreshAllowed) {
        const refreshed = await this.refresh();
        if (refreshed.success) {
          return this.createResource(resource, data, false);
        }
      }
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async updateResource(resource, id, data, refreshAllowed = true) {
    try {
      const headers = data instanceof FormData
        ? { "Content-Type": undefined }
        : {};

      const res = await apiClient.patch(`${resource}/${id}`, data, { headers });
      return { success: true, data: res.data };
    } catch (error) {
      if (error.response?.status === 401 && refreshAllowed) {
        const refreshed = await this.refresh();
        if (refreshed.success) {
          return this.updateResource(resource, id, data, false);
        }
      }
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async deleteResource(resource, id, refreshAllowed = true) {
    try {
      await apiClient.delete(`${resource}/${id}/`);
      return { success: true };
    } catch (error) {
      if (error.response?.status === 401 && refreshAllowed) {
        const refreshed = await this.refresh();
        if (refreshed.success) return this.deleteResource(resource, id, false);
      }
      return { success: false, error: getErrorMessage(error) };
    }
  },
};

apiService.refresh();
