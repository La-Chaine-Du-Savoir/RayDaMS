import {Group, GroupWithUsers, GroupWithUsersAndGames} from "../DataObjects/Group.ts";
import {User} from "../DataObjects/User.ts";

import db from "../../Services/database.ts";
const table = "groups";

export async function create(group: Group): Promise<Group> {
    const result = await db.queryObject<Group>(
        `INSERT INTO ${table}
            (name, code)
         VALUES
            ($1, $2)
         RETURNING id, name, code, created_at`,
        [
            group.name,
            group.code,
        ],
    );

    return result.rows[0];
}

export async function getById(id: number): Promise<GroupWithUsers | undefined> {
    const result = await db.queryObject<Group & { users: User[] }>(
        `SELECT
             g.*,
             COALESCE(
                     json_agg(
                             json_build_object(
                                     'id', u.id,
                                     'username', u.username,
                                     'email', u.email,
                                     'path_profil_picture', u.path_profil_picture
                             )
                     ) FILTER (WHERE u.id IS NOT NULL),
                     '[]'
             ) AS users
         FROM groups g
                  LEFT JOIN users_groups ug ON g.id = ug.group_id
                  LEFT JOIN users u ON ug.user_id = u.id
         WHERE g.id = $1
         GROUP BY g.id`,
        [id],
    );

    return result.rows[0];
}

export async function getByIdWithGames(id: number): Promise<GroupWithUsersAndGames | undefined> {
    const result = await db.queryObject<GroupWithUsersAndGames>(
        `SELECT
             g.*,
             COALESCE(u_data.users, '[]') AS users,
             COALESCE(gm_data.games, '[]') AS games
         FROM groups g
          -- Sous-requête ciblée pour les utilisateurs de ce groupe
          LEFT JOIN (
             SELECT
                 ug.group_id,
                 json_agg(
                         json_build_object(
                                 'id', u.id,
                                 'username', u.username,
                                 'email', u.email,
                                 'path_profil_picture', u.path_profil_picture
                         )
                 ) AS users
             FROM users_groups ug
                      JOIN users u ON ug.user_id = u.id
             WHERE ug.group_id = $1
             GROUP BY ug.group_id
         ) u_data ON g.id = u_data.group_id
          -- Sous-requête ciblée pour les jeux de ce groupe
          LEFT JOIN (
             SELECT
                 group_id,
                 json_agg(
                         json_build_object(
                                 'id', id,
                                 'name', name,
                                 'thumbnail_path', thumbnail_path,
                                 'status', status,
                                 'author', author
                         )
                 ) AS games
             FROM games
             WHERE group_id = $1
             GROUP BY group_id
         ) gm_data ON g.id = gm_data.group_id
         WHERE g.id = $1`,
        [id],
    );

    return result.rows[0];
}

export async function getAllGroups(): Promise<GroupWithUsers[]> {
    const result = await db.queryObject<Group & { users: User[] }>(
        `SELECT
             g.*,
             COALESCE(
                     json_agg(
                             json_build_object(
                                     'id', u.id,
                                     'username', u.username,
                                     'email', u.email,
                                     'path_profil_picture', u.path_profil_picture
                             )
                     ) FILTER (WHERE u.id IS NOT NULL),
                     '[]'
             ) AS users
         FROM groups g
                  LEFT JOIN users_groups ug ON g.id = ug.group_id
                  LEFT JOIN users u ON ug.user_id = u.id
         GROUP BY g.id
         ORDER BY g.created_at DESC`
    );

    return result.rows;
}

export async function deleteGroup(id: number): Promise<boolean> {
    const result = await db.queryObject(
        `DELETE FROM groups WHERE id = $1`,
        [id]
    );

    return result.rowCount ? result.rowCount > 0 : false;
}

export async function addUserToGroup(groupId: number, userId: number): Promise<boolean> {
    const result = await db.queryObject(
        `INSERT INTO users_groups (group_id, user_id) 
         VALUES ($1, $2) 
         ON CONFLICT DO NOTHING`,
        [groupId, userId]
    );

    return result.rowCount ? result.rowCount > 0 : false;
}

export async function removeUserFromGroup(groupId: number, userId: number): Promise<boolean> {
    const result = await db.queryObject(
        `DELETE FROM users_groups 
         WHERE group_id = $1 AND user_id = $2`,
        [groupId, userId]
    );

    return result.rowCount ? result.rowCount > 0 : false;
}

export async function updateGroupName(id: number, newName: string): Promise<Group | undefined> {
    const result = await db.queryObject<Group>(
        `UPDATE groups 
         SET name = $1 
         WHERE id = $2 
         RETURNING *`,
        [newName, id]
    );

    return result.rows[0];
}

export async function getByCode(code: string): Promise<Group | undefined> {
    const result = await db.queryObject<Group>(
        `SELECT *
         FROM groups
         WHERE code = $1`,
        [code]
    );

    return result.rows[0];
}

export async function getGroupsByUserId(userId: number): Promise<GroupWithUsers[]> {
    const result = await db.queryObject<GroupWithUsers>(
        `SELECT
             g.*,
             COALESCE(
                     json_agg(
                             json_build_object(
                                     'id', u.id,
                                     'username', u.username,
                                     'email', u.email,
                                     'path_profil_picture', u.path_profil_picture
                             )
                     ) FILTER (WHERE u.id IS NOT NULL),
                     '[]'
             ) AS users
         FROM groups g
                  LEFT JOIN users_groups ug ON g.id = ug.group_id
                  LEFT JOIN users u ON ug.user_id = u.id
         WHERE g.id IN (SELECT group_id FROM users_groups WHERE user_id = $1)
         GROUP BY g.id
         ORDER BY g.created_at DESC`,
        [userId]
    );

    return result.rows;
}

export async function getGroupsWithGames(): Promise<any[]> {
    const result = await db.queryObject(
        `SELECT
             g.id, 
             g.name, 
             g.code,
             -- liste des IDs des membres pour permission d'édition
             COALESCE(
                 (SELECT array_agg(user_id) FROM users_groups WHERE group_id = g.id),
                 '{}'
             ) AS member_ids,
             -- On mets les jeux du groupe
             COALESCE(
                 json_agg(
                     json_build_object(
                         'id', gm.id,
                         'name', gm.name,
                         'thumbnail_path', gm.thumbnail_path,
                         'status', gm.status,
                         'author', gm.author
                     )
                 ) FILTER (WHERE gm.id IS NOT NULL),
                 '[]'
             ) AS games
         FROM groups g
         LEFT JOIN games gm ON g.id = gm.group_id
         GROUP BY g.id
         ORDER BY g.created_at DESC`
    );

    return result.rows;
}

const groupRepository = { create, getById, getByIdWithGames, getAllGroups, deleteGroup, addUserToGroup, removeUserFromGroup, updateGroupName, getByCode, getGroupsByUserId, getGroupsWithGames };

export default groupRepository;