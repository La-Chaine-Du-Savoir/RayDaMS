import cloud from "../../Services/cloud.ts";

export interface Game {
  id?: number;
  name: string;
  thumbnail_path?: string;
  path_screenshot?: string;
  url_trailer?: string;
  description: string;
  author: number;
  group_id: number;
  path_sources?: string;
  sources_uploaded: boolean;
  path_js?: string;
  path_wasm?: string;
  path_data?: string;
  status: "pending" | "running" | "success" | "failed";
}

export interface SanitizedGame extends
  Omit<
    Game,
    | "thumbnail_path"
    | "path_screenshot"
    | "path_sources"
    | "path_js"
    | "path_wasm"
    | "path_data"
  > {
  url_thumbnail: string | null;
  url_screenshot?: string | null;
  url_sources?: string | null;
  url_js?: string | null;
  url_wasm?: string | null;
  url_data?: string | null;
}

export async function sanitizeGame(game: Game): Promise<SanitizedGame> {
  const {
    thumbnail_path,
    path_screenshot,
    path_sources,
    path_js,
    path_wasm,
    path_data,
    ...publicGame
  } = game;

  const [
    urlThumbnail,
    urlScreenshot,
    urlSources,
    urlJs,
    urlWasm,
    urlData,
  ] = await Promise.all([
    thumbnail_path
      ? cloud.getPresigned(thumbnail_path, 3600, "download")
      : Promise.resolve(null),
    path_screenshot
      ? cloud.getPresigned(path_screenshot, 3600, "download")
      : Promise.resolve(null),
    path_sources && publicGame.sources_uploaded
      ? cloud.getPresigned(path_sources, 3600, "download")
      : Promise.resolve(null),
    path_js
      ? cloud.getPresigned(path_js, 3600, "download")
      : Promise.resolve(null),
    path_wasm
      ? cloud.getPresigned(path_wasm, 3600, "download")
      : Promise.resolve(null),
    path_data
      ? cloud.getPresigned(path_data, 3600, "download")
      : Promise.resolve(null),
  ]);

  return {
    ...publicGame,
    url_thumbnail: urlThumbnail,
    url_screenshot: urlScreenshot,
    url_sources: urlSources,
    url_js: urlJs,
    url_wasm: urlWasm,
    url_data: urlData,
  };
}
