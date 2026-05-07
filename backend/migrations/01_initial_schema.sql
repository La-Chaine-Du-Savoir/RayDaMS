DROP TABLE IF EXISTS roles_users;
DROP TABLE IF EXISTS users_groups;
DROP TABLE IF EXISTS games;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS groups;
DROP TABLE IF EXISTS users;

CREATE TABLE users(
                      id SERIAL,
                      username VARCHAR(50) NOT NULL,
                      email VARCHAR(255) NOT NULL,
                      password_hash TEXT NOT NULL,
                      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                      path_profil_picture VARCHAR(255),
                      is_admin BOOLEAN DEFAULT FALSE,
                      PRIMARY KEY(id),
                      UNIQUE(email)
);

CREATE TABLE groups(
                       id SERIAL,
                       name VARCHAR(100) NOT NULL,
                       code CHAR(10),
                       PRIMARY KEY(id),
                       UNIQUE(name)
);

CREATE TABLE roles(
                      id SERIAL,
                      label VARCHAR(50) NOT NULL,
                      PRIMARY KEY(id)
);

CREATE TABLE games(
                      id SERIAL,
                      name VARCHAR(128) NOT NULL,
                      thumbnail_path VARCHAR(255),
                      path_screenshot VARCHAR(255),
                      url_trailer VARCHAR(255),
                      description TEXT,
                      author VARCHAR(100),
                      group_id INT NOT NULL,
                      PRIMARY KEY(id),
                      FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE
);

CREATE TABLE users_groups(
                             user_id INT,
                             group_id INT,
                             PRIMARY KEY(user_id, group_id),
                             FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                             FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE
);

CREATE TABLE roles_users(
                            user_id INT,
                            role_id INT,
                            PRIMARY KEY(user_id, role_id),
                            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                            FOREIGN KEY(role_id) REFERENCES roles(id) ON DELETE CASCADE
);