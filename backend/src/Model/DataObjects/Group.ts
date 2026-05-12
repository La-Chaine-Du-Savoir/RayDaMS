import {User} from "./User.ts";

export interface Group {
    id?: number;
    name: string;
    code: string;
    created_at?: Date;
    users?: User[];
}