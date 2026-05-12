import axios, { type AxiosError, type AxiosInstance } from 'axios';

// --- TYPES (À déplacer idéalement dans un fichier src/types.ts) ---
export interface User { id: number; email: string; name: string; }
export interface Violation { propertyPath: string; message: string; }
export interface ProblemDetails { type?: string; title?: string; status?: number; violations?: Violation[]; }

function convertErrorToProblemDetails(error: AxiosError): ProblemDetails | undefined {
    const data = error.response?.data as any;
    if (data && typeof data === 'object') {
        const details: ProblemDetails = {
            type: data?.type,
            status: data?.status,
            title: data?.title,
        };

        const violations: Violation[] = [];
        // On extrait les violations si elles existent (format Symfony/API Platform ou Django)
        for (const key in data) {
            if (!['type', 'title', 'status'].includes(key) && Array.isArray(data[key])) {
                data[key].forEach((message: string) => {
                    violations.push({ propertyPath: key, message });
                });
            }
        }
        details.violations = violations.length > 0 ? violations : undefined;
        return details;
    }
}

// --- ÉTAT INTERNE DU SERVICE (Remplace Pinia) ---
let refreshPromise: Promise<any> | null = null;

const apiClient: AxiosInstance = axios.create({
    baseURL: "http://localhost:8000", // À remplacer par ton URL réelle
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
});

export const apiService = {
    connectedUser: null as User | null,
    isAuthenticated: false,

    // --- AUTHENTIFICATION ---
    async login(email: string, password: string) {
        try {
            const res = await apiClient.post('auth/login', { email, password });
            this.connectedUser = res.data.user;
            this.isAuthenticated = true;
            return { success: true, user: res.data.user };
        } catch (error) {
            return { success: false, error: convertErrorToProblemDetails(error as AxiosError) };
        }
    },

    async logout() {
        try {
            await apiClient.post('auth/logout');
            this.connectedUser = null;
            this.isAuthenticated = false;
            return { success: true };
        } catch (error) {
            return { success: false, error: convertErrorToProblemDetails(error as AxiosError) };
        }
    },

    refresh() {
        if (refreshPromise) return refreshPromise;
        refreshPromise = (async () => {
            try {
                await apiClient.post('/auth/token/refresh');
                this.isAuthenticated = true;
                const res = await apiClient.get('auth/user/');
                this.connectedUser = res.data as User;
                return { success: true, user: res.data };
            } catch (error) {
                return { success: false, error: convertErrorToProblemDetails(error as AxiosError) };
            } finally {
                refreshPromise = null;
            }
        })();
        return refreshPromise;
    },

    async getAll(resource: string, refreshAllowed = true): Promise<any> {
        try {
            const res = await apiClient.get(resource);
            return { success: true, data: res.data?.results || res.data, next: res.data?.next };
        } catch (error: any) {
            if (error.response?.status === 401 && refreshAllowed) {
                const refreshed = await this.refresh();
                if (refreshed.success) return this.getAll(resource, false);
            }
            return { success: false, error: convertErrorToProblemDetails(error as AxiosError) };
        }
    },

    async getById(resource: string, id: number, refreshAllowed = true): Promise<any> {
        try {
            const res = await apiClient.get(`${resource}/${id}/`);
            return { success: true, data: res.data };
        } catch (error: any) {
            if (error.response?.status === 401 && refreshAllowed) {
                const refreshed = await this.refresh();
                if (refreshed.success) return this.getById(resource, id, false);
            }
            return { success: false, error: convertErrorToProblemDetails(error as AxiosError) };
        }
    },

    async createResource(resource: string, data: object, refreshAllowed = true): Promise<any> {
        try {
            const headers = data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {};
            const res = await apiClient.post(`${resource}/`, data, { headers });
            return { success: true, data: res.data };
        } catch (error: any) {
            if (error.response?.status === 401 && refreshAllowed) {
                const refreshed = await this.refresh();
                if (refreshed.success) return this.createResource(resource, data, false);
            }
            return { success: false, error: convertErrorToProblemDetails(error as AxiosError) };
        }
    },

    async updateResource(resource: string, id: string | number, data: object, refreshAllowed = true): Promise<any> {
        try {
            const headers = data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {};
            const res = await apiClient.patch(`${resource}/${id}/`, data, { headers });
            return { success: true, data: res.data };
        } catch (error: any) {
            if (error.response?.status === 401 && refreshAllowed) {
                const refreshed = await this.refresh();
                if (refreshed.success) return this.updateResource(resource, id, data, false);
            }
            return { success: false, error: convertErrorToProblemDetails(error as AxiosError) };
        }
    },

    async deleteResource(resource: string, id: number, refreshAllowed = true): Promise<any> {
        try {
            await apiClient.delete(`${resource}/${id}/`);
            return { success: true };
        } catch (error: any) {
            if (error.response?.status === 401 && refreshAllowed) {
                const refreshed = await this.refresh();
                if (refreshed.success) return this.deleteResource(resource, id, false);
            }
            return { success: false, error: convertErrorToProblemDetails(error as AxiosError) };
        }
    }
};