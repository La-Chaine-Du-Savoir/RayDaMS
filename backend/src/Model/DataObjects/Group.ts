import { SanitizedUser, sanitizeUser, User } from "./User.ts";
import { Game, SanitizedGame, sanitizeGame } from "./Game.ts";

export interface Group {
  id?: number;
  name: string;
  code?: string;
  created_at?: Date;
}

export type GroupWithUsers = Group & { users: User[] };
export type SanitizedGroupWithUsers = Group & { users: SanitizedUser[] };

export type GroupWithUsersAndGames = Group & { users: User[] } & {
  games: Game[];
};
export type SanitizedGroupWithUsersAndGames =
  & Group
  & { users: SanitizedUser[] }
  & { games: SanitizedGame[] };

// Raw type retourné par la requête SQL utilisée dans GroupRepository.getGroupsWithGames
export type RawGroupWithGames = {
  id: number;
  name: string;
  code?: string | null;
  member_ids: Array<number | string>;
  games: Game[];
};

export async function sanitizeGroup(
  group: GroupWithUsers,
  isAdmin: boolean = false,
): Promise<SanitizedGroupWithUsers> {
  const sanitizedUsers = await Promise.all(
    group.users.map((user) => sanitizeUser(user)),
  );

  // Le code n'est envoy� que si c'est un admin
  if (!isAdmin) {
    group.code = undefined;
  }

  return {
    ...group,
    users: sanitizedUsers,
  };
}

export async function sanitizeGroupWithGames(
  group: GroupWithUsersAndGames,
  isAdmin: boolean = false,
): Promise<SanitizedGroupWithUsersAndGames> {
  const sanitizedUsers = await Promise.all(
    group.users.map((user) => sanitizeUser(user)),
  );

  let sanitizedGames: SanitizedGame[];
  if (group.games && group.games.length > 0) {
    sanitizedGames = await Promise.all(
      group.games.map(async (game: Game) => {
        return await sanitizeGame(game);
      }),
    );
  } else {
    sanitizedGames = [];
  }

  if (!isAdmin) {
    group.code = undefined;
  }

  return {
    ...group,
    users: sanitizedUsers,
    games: sanitizedGames,
  };
}
