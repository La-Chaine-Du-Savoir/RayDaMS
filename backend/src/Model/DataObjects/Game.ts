export interface Game {
    id?: number;
    name: string;
    thumbnail_path?: string;
    path_screenshot?: string;
    url_trailer?: string;
    description: string;
    author: number;
    group_id: number;
    path_sources: string;
    path_js?: string;
    path_wasm?: string;
    path_data?: string;
    status: "pending" | "running" | "success" | "failed";
}