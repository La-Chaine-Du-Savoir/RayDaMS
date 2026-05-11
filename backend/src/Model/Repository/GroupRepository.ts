import { Group } from "../DataObjects/Group.ts";
import {User} from "../DataObjects/User.ts";

import db from "../../Services/database.ts";
const table = "groups";

export async function create(group: Group): Promise<Group> {
    const result = await db.queryObject<Group>(
        `INSERT INTO ${table}
            (name, code)
         VALUES
            ($1, $2, $3, $4)
         RETURNING id, name, code`,
        [
            group.name,
            group.code,
        ],
    );

    return result.rows[0];
}

export async function getById(id: number): Promise<Group | undefined> {
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


const groupRepository = { create, getById};

export default groupRepository;