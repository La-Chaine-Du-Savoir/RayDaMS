import axios from 'axios';

function getErrorMessage(error) {
    const data = error.response?.data;

    if (data && typeof data === 'object') {
        if (data.title) return data.title;
        for (const key in data) {
            if (Array.isArray(data[key]) && data[key].length > 0) {
                return `${key}: ${data[key][0]}`;
            }
        }
    }

    return error.message || "Une erreur inconnue est survenue";
}

let refreshPromise = null;

const apiClient = axios.create({
    baseURL: "http://localhost:3000",
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
});

export const apiService = {
    connectedUser: null,
    isAuthenticated: false,

    async login(email, password) {
        try {
            const res = await apiClient.post('auth/login', { email, password });
            this.connectedUser = res.data.user;
            this.isAuthenticated = true;
            return { success: true, user: res.data.user };
        } catch (error) {
            return { success: false, error: getErrorMessage(error) };
        }
    },

    async logout() {
        try {
            await apiClient.post('auth/logout');
            this.connectedUser = null;
            this.isAuthenticated = false;
            return { success: true };
        } catch (error) {
            return { success: false, error: getErrorMessage(error) };
        }
    },

    async refresh() {
        if (refreshPromise) return refreshPromise;

        refreshPromise = (async () => {
            try {
                await apiClient.post('/auth/token/refresh');
                this.isAuthenticated = true;
                const res = await apiClient.get('auth/user/');
                this.connectedUser = res.data;
                return { success: true, user: res.data };
            } catch (error) {
                this.isAuthenticated = false;
                this.connectedUser = null;
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
                next: res.data?.next
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
            const headers = data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {};
            const res = await apiClient.post(`${resource}/`, data, { headers });
            return { success: true, data: res.data };
        } catch (error) {
            if (error.response?.status === 401 && refreshAllowed) {
                const refreshed = await this.refresh();
                if (refreshed.success) return this.createResource(resource, data, false);
            }
            return { success: false, error: getErrorMessage(error) };
        }
    },

    async updateResource(resource, id, data, refreshAllowed = true) {
        try {
            const headers = data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {};
            const res = await apiClient.patch(`${resource}/${id}/`, data, { headers });
            return { success: true, data: res.data };
        } catch (error) {
            if (error.response?.status === 401 && refreshAllowed) {
                const refreshed = await this.refresh();
                if (refreshed.success) return this.updateResource(resource, id, data, false);
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
    }
};